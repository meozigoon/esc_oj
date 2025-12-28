import { Language, Problem, SubmissionStatus } from '@prisma/client';
import { spawn } from 'child_process';

export type JudgeResult = {
  status: SubmissionStatus;
  message: string;
  detail?: string | null;
  runtimeMs?: number | null;
  memoryKb?: number | null;
  failedTestcaseOrd?: number | null;
};

type ExecResult = {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

type LanguageConfig = {
  sourceFile: string;
  compile?: string;
  run: string;
};

type TestcaseInput = {
  ord: number;
  input: string;
  output: string;
};

type PreparedProgram = {
  volumeName: string;
  config: LanguageConfig;
};

type PrepareError = {
  stage: 'write' | 'compile';
  result: ExecResult;
};

const languageConfigs: Record<Language, LanguageConfig> = {
  C99: {
    sourceFile: 'Main.c',
    compile: 'gcc -O2 -std=c99 Main.c -o Main',
    run: './Main'
  },
  CPP17: {
    sourceFile: 'Main.cpp',
    compile: 'g++ -O2 -std=c++17 Main.cpp -o Main',
    run: './Main'
  },
  JAVA11: {
    sourceFile: 'Main.java',
    compile: 'javac Main.java',
    run: 'java Main'
  },
  PYTHON3: {
    sourceFile: 'Main.py',
    run: 'python3 Main.py'
  },
  CS: {
    sourceFile: 'Main.cs',
    compile: 'mcs -optimize+ -out:Main.exe Main.cs',
    run: 'mono Main.exe'
  }
};

function normalizeOutput(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

function trimTrailingWhitespace(value: string): string {
  return value.replace(/[ \t\n\r]+$/g, '');
}

function stripAllWhitespace(value: string): string {
  return value.replace(/[ \t\n\r]+/g, '');
}

function formatExecError(result: ExecResult): string {
  return result.stderr || result.stdout || 'Unknown error';
}

function parseGeneratedInputs(output: string): string[] {
  const normalized = normalizeOutput(output).trim();
  if (!normalized) {
    return [];
  }

  try {
    const parsed = JSON.parse(normalized);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed as string[];
    }
  } catch {
    // Fall back to delimiter parsing below.
  }

  const lines = normalized.split('\n');
  const inputs: string[] = [];
  let buffer: string[] = [];
  let sawSeparator = false;

  for (const line of lines) {
    if (line.trim() === '---') {
      inputs.push(buffer.join('\n'));
      buffer = [];
      sawSeparator = true;
      continue;
    }
    buffer.push(line);
  }

  if (buffer.length > 0 || sawSeparator) {
    inputs.push(buffer.join('\n'));
  }

  return inputs;
}

async function runProcess(
  command: string,
  args: string[],
  input?: string,
  timeoutMs?: number
): Promise<ExecResult> {
  return new Promise((resolve) => {
    let resolved = false;
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    if (input !== undefined) {
      child.stdin.write(input);
    }
    child.stdin.end();

    let timer: NodeJS.Timeout | null = null;
    if (timeoutMs) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);
    }

    child.on('error', (err) => {
      if (timer) {
        clearTimeout(timer);
      }
      if (resolved) {
        return;
      }
      resolved = true;
      resolve({ code: -1, stdout, stderr: `${stderr}${err.message}`, timedOut });
    });

    child.on('close', (code) => {
      if (timer) {
        clearTimeout(timer);
      }
      if (resolved) {
        return;
      }
      resolved = true;
      resolve({ code: code ?? -1, stdout, stderr, timedOut });
    });
  });
}

async function dockerRun(args: string[], input?: string, timeoutMs?: number): Promise<ExecResult> {
  return runProcess('docker', args, input, timeoutMs);
}

function buildDockerArgs(options: {
  image: string;
  volumeName: string;
  command: string;
  memoryLimitMb: number;
}): string[] {
  return [
    'run',
    '--rm',
    '-i',
    '--network',
    'none',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--pids-limit',
    '64',
    '--read-only',
    '--tmpfs',
    '/tmp:rw,noexec,nosuid,size=64m',
    '--cpus',
    '1',
    '--memory',
    `${options.memoryLimitMb}m`,
    '--memory-swap',
    `${options.memoryLimitMb}m`,
    '-v',
    `${options.volumeName}:/workspace:rw`,
    '-w',
    '/workspace',
    options.image,
    'sh',
    '-c',
    options.command
  ];
}

async function writeFileToVolume(
  image: string,
  volumeName: string,
  fileName: string,
  content: string
): Promise<ExecResult> {
  const args = [
    'run',
    '--rm',
    '-i',
    '--network',
    'none',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '-v',
    `${volumeName}:/workspace:rw`,
    '-w',
    '/workspace',
    image,
    'sh',
    '-c',
    `cat > /workspace/${fileName}`
  ];
  return dockerRun(args, content, 5000);
}

function wrapTimeout(command: string, timeoutMs: number): string {
  const seconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  return `timeout -s KILL ${seconds}s ${command}`;
}

async function createVolume(volumeName: string): Promise<void> {
  const result = await runProcess('docker', ['volume', 'create', volumeName]);
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || 'Failed to create volume');
  }
}

async function removeVolume(volumeName: string): Promise<void> {
  await runProcess('docker', ['volume', 'rm', '-f', volumeName]);
}

async function prepareProgram(options: {
  submissionId: number;
  label: string;
  language: Language;
  code: string;
  image: string;
  memoryLimitMb: number;
  compileTimeoutMs: number;
}): Promise<{ program: PreparedProgram } | { error: PrepareError }> {
  const config = languageConfigs[options.language];
  const volumeName = `oj-${options.label}-${options.submissionId}-${Date.now()}`;

  await createVolume(volumeName);

  const writeResult = await writeFileToVolume(
    options.image,
    volumeName,
    config.sourceFile,
    options.code
  );
  if (writeResult.code !== 0) {
    await removeVolume(volumeName);
    return { error: { stage: 'write', result: writeResult } };
  }

  if (config.compile) {
    const compileCommand = wrapTimeout(config.compile, options.compileTimeoutMs);
    const compileResult = await dockerRun(
      buildDockerArgs({
        image: options.image,
        volumeName,
        command: compileCommand,
        memoryLimitMb: options.memoryLimitMb
      }),
      undefined,
      options.compileTimeoutMs + 1000
    );

    if (compileResult.code !== 0 || compileResult.timedOut) {
      await removeVolume(volumeName);
      return { error: { stage: 'compile', result: compileResult } };
    }
  }

  return { program: { volumeName, config } };
}

async function runProgram(options: {
  program: PreparedProgram;
  image: string;
  input: string;
  timeLimitMs: number;
  memoryLimitMb: number;
}): Promise<ExecResult> {
  const runCommand = wrapTimeout(options.program.config.run, options.timeLimitMs);
  return dockerRun(
    buildDockerArgs({
      image: options.image,
      volumeName: options.program.volumeName,
      command: runCommand,
      memoryLimitMb: options.memoryLimitMb
    }),
    options.input,
    options.timeLimitMs + 1000
  );
}

export async function judgeSubmission(options: {
  submissionId: number;
  language: Language;
  code: string;
  problem: Problem;
  testcases: TestcaseInput[];
  image: string;
}): Promise<JudgeResult> {
  const useGeneratedTests =
    options.problem.generatorLanguage &&
    options.problem.generatorCode &&
    options.problem.solutionLanguage &&
    options.problem.solutionCode;
  const memoryLimitMb = Math.max(64, options.problem.memoryLimitMb || 256);
  const compileTimeoutMs = 10000;
  let totalRuntime = 0;
  const volumesToCleanup: string[] = [];

  try {
    const submissionPrepared = await prepareProgram({
      submissionId: options.submissionId,
      label: 'sub',
      language: options.language,
      code: options.code,
      image: options.image,
      memoryLimitMb,
      compileTimeoutMs
    });

    if ('error' in submissionPrepared) {
      const { result } = submissionPrepared.error;
      if (submissionPrepared.error.stage === 'compile') {
        if (result.timedOut || result.code === 124) {
          return {
            status: SubmissionStatus.TIME_LIMIT_EXCEEDED,
            message: '시간 초과',
            detail: formatExecError(result)
          };
        }
        if (result.code === 137) {
          return {
            status: SubmissionStatus.MEMORY_LIMIT_EXCEEDED,
            message: '메모리 초과',
            detail: formatExecError(result)
          };
        }
        return {
          status: SubmissionStatus.COMPILE_ERROR,
          message: '컴파일 에러',
          detail: formatExecError(result)
        };
      }
      return {
        status: SubmissionStatus.SYSTEM_ERROR,
        message: '시스템 오류',
        detail: formatExecError(result)
      };
    }

    const submissionProgram = submissionPrepared.program;
    volumesToCleanup.push(submissionProgram.volumeName);

    if (!useGeneratedTests) {
      for (const testcase of options.testcases) {
        const start = Date.now();
        const runResult = await runProgram({
          program: submissionProgram,
          image: options.image,
          input: testcase.input,
          timeLimitMs: options.problem.timeLimitMs,
          memoryLimitMb
        });
        const elapsed = Date.now() - start;
        totalRuntime += elapsed;

        if (runResult.timedOut || runResult.code === 124) {
          return {
            status: SubmissionStatus.TIME_LIMIT_EXCEEDED,
            message: '시간 초과',
            runtimeMs: totalRuntime,
            failedTestcaseOrd: testcase.ord
          };
        }
        if (runResult.code === 137) {
          return {
            status: SubmissionStatus.MEMORY_LIMIT_EXCEEDED,
            message: '메모리 초과',
            runtimeMs: totalRuntime,
            failedTestcaseOrd: testcase.ord
          };
        }

        if (runResult.code !== 0) {
          return {
            status: SubmissionStatus.RUNTIME_ERROR,
            message: '런타임 에러',
            detail: formatExecError(runResult),
            runtimeMs: totalRuntime,
            failedTestcaseOrd: testcase.ord
          };
        }

        const expectedRaw = normalizeOutput(testcase.output);
        const actualRaw = normalizeOutput(runResult.stdout);
        const expected = trimTrailingWhitespace(expectedRaw);
        const actual = trimTrailingWhitespace(actualRaw);

        if (expected !== actual) {
          const expectedLoose = stripAllWhitespace(expected);
          const actualLoose = stripAllWhitespace(actual);

          if (expectedLoose === actualLoose) {
            return {
              status: SubmissionStatus.PRESENTATION_ERROR,
              message: '출력 형식 오류',
              detail: '공백/개행만 다른 출력입니다.',
              runtimeMs: totalRuntime,
              failedTestcaseOrd: testcase.ord
            };
          }

          return {
            status: SubmissionStatus.WRONG_ANSWER,
            message: '틀렸습니다.',
            runtimeMs: totalRuntime,
            failedTestcaseOrd: testcase.ord
          };
        }
      }

      return {
        status: SubmissionStatus.ACCEPTED,
        message: '맞았습니다!',
        runtimeMs: totalRuntime
      };
    }

    const generatorPrepared = await prepareProgram({
      submissionId: options.submissionId,
      label: 'gen',
      language: options.problem.generatorLanguage!,
      code: options.problem.generatorCode!,
      image: options.image,
      memoryLimitMb,
      compileTimeoutMs
    });

    if ('error' in generatorPrepared) {
      const { result } = generatorPrepared.error;
      return {
        status: SubmissionStatus.SYSTEM_ERROR,
        message: '테스트케이스 생성 실패',
        detail: formatExecError(result)
      };
    }

    const generatorProgram = generatorPrepared.program;
    const generatorTimeoutMs = Math.max(2000, options.problem.timeLimitMs);
    const generatorRun = await runProgram({
      program: generatorProgram,
      image: options.image,
      input: '',
      timeLimitMs: generatorTimeoutMs,
      memoryLimitMb
    });
    await removeVolume(generatorProgram.volumeName);

    if (generatorRun.timedOut || generatorRun.code === 124) {
      return {
        status: SubmissionStatus.SYSTEM_ERROR,
        message: '테스트케이스 생성 실패',
        detail: '테스트케이스 생성 시간이 초과되었습니다.'
      };
    }
    if (generatorRun.code === 137) {
      return {
        status: SubmissionStatus.SYSTEM_ERROR,
        message: '테스트케이스 생성 실패',
        detail: '테스트케이스 생성 중 메모리 초과가 발생했습니다.'
      };
    }
    if (generatorRun.code !== 0) {
      return {
        status: SubmissionStatus.SYSTEM_ERROR,
        message: '테스트케이스 생성 실패',
        detail: formatExecError(generatorRun)
      };
    }

    const generatedInputs = parseGeneratedInputs(generatorRun.stdout);
    if (generatedInputs.length === 0) {
      return {
        status: SubmissionStatus.SYSTEM_ERROR,
        message: '테스트케이스 생성 실패',
        detail: '테스트케이스 생성 출력이 비어 있습니다.'
      };
    }

    const solutionPrepared = await prepareProgram({
      submissionId: options.submissionId,
      label: 'sol',
      language: options.problem.solutionLanguage!,
      code: options.problem.solutionCode!,
      image: options.image,
      memoryLimitMb,
      compileTimeoutMs
    });

    if ('error' in solutionPrepared) {
      const { result } = solutionPrepared.error;
      return {
        status: SubmissionStatus.SYSTEM_ERROR,
        message: '정답 코드 실행 실패',
        detail: formatExecError(result)
      };
    }

    const solutionProgram = solutionPrepared.program;
    volumesToCleanup.push(solutionProgram.volumeName);

    for (let index = 0; index < generatedInputs.length; index += 1) {
      const input = generatedInputs[index];
      const ord = index + 1;

      const solutionRun = await runProgram({
        program: solutionProgram,
        image: options.image,
        input,
        timeLimitMs: options.problem.timeLimitMs,
        memoryLimitMb
      });

      if (solutionRun.timedOut || solutionRun.code === 124) {
        return {
          status: SubmissionStatus.SYSTEM_ERROR,
          message: '정답 코드 실행 실패',
          detail: `테스트케이스 ${ord}에서 정답 코드가 시간 초과되었습니다.`
        };
      }
      if (solutionRun.code === 137) {
        return {
          status: SubmissionStatus.SYSTEM_ERROR,
          message: '정답 코드 실행 실패',
          detail: `테스트케이스 ${ord}에서 정답 코드가 메모리 초과되었습니다.`
        };
      }
      if (solutionRun.code !== 0) {
        return {
          status: SubmissionStatus.SYSTEM_ERROR,
          message: '정답 코드 실행 실패',
          detail: formatExecError(solutionRun)
        };
      }

      const start = Date.now();
      const submissionRun = await runProgram({
        program: submissionProgram,
        image: options.image,
        input,
        timeLimitMs: options.problem.timeLimitMs,
        memoryLimitMb
      });
      const elapsed = Date.now() - start;
      totalRuntime += elapsed;

      if (submissionRun.timedOut || submissionRun.code === 124) {
        return {
          status: SubmissionStatus.TIME_LIMIT_EXCEEDED,
          message: '시간 초과',
          runtimeMs: totalRuntime,
          failedTestcaseOrd: ord
        };
      }
      if (submissionRun.code === 137) {
        return {
          status: SubmissionStatus.MEMORY_LIMIT_EXCEEDED,
          message: '메모리 초과',
          runtimeMs: totalRuntime,
          failedTestcaseOrd: ord
        };
      }
      if (submissionRun.code !== 0) {
        return {
          status: SubmissionStatus.RUNTIME_ERROR,
          message: '런타임 에러',
          detail: formatExecError(submissionRun),
          runtimeMs: totalRuntime,
          failedTestcaseOrd: ord
        };
      }

      const expectedRaw = normalizeOutput(solutionRun.stdout);
      const actualRaw = normalizeOutput(submissionRun.stdout);
      const expected = trimTrailingWhitespace(expectedRaw);
      const actual = trimTrailingWhitespace(actualRaw);

      if (expected !== actual) {
        const expectedLoose = stripAllWhitespace(expected);
        const actualLoose = stripAllWhitespace(actual);

        if (expectedLoose === actualLoose) {
          return {
            status: SubmissionStatus.PRESENTATION_ERROR,
            message: '출력 형식 오류',
            detail: '공백/개행만 다른 출력입니다.',
            runtimeMs: totalRuntime,
            failedTestcaseOrd: ord
          };
        }

        return {
          status: SubmissionStatus.WRONG_ANSWER,
          message: '틀렸습니다.',
          runtimeMs: totalRuntime,
          failedTestcaseOrd: ord
        };
      }
    }

    return {
      status: SubmissionStatus.ACCEPTED,
      message: '맞았습니다!',
      runtimeMs: totalRuntime
    };
  } catch (error) {
    return {
      status: SubmissionStatus.SYSTEM_ERROR,
      message: '시스템 오류',
      detail: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await Promise.all(volumesToCleanup.map((name) => removeVolume(name)));
  }
}
