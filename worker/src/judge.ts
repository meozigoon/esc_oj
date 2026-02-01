import { Language, Problem, SubmissionStatus } from "@prisma/client";
import { spawn } from "child_process";

export type JudgeResult = {
    status: SubmissionStatus;
    message: string;
    detail?: string | null;
    runtimeMs?: number | null;
    memoryKb?: number | null;
    failedTestcaseOrd?: number | null;
};

export type JudgeProgress = {
    current: number;
    total: number;
    percent: number;
};

export type RunResult = {
    status: SubmissionStatus;
    message: string;
    stdout: string;
    stderr: string;
    runtimeMs?: number | null;
    memoryKb?: number | null;
};

type ExecResult = {
    code: number;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    memoryKb?: number | null;
    stdoutTruncated?: boolean;
    stderrTruncated?: boolean;
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
    stage: "write" | "compile";
    result: ExecResult;
};

const languageConfigs: Record<Language, LanguageConfig> = {
    C99: {
        sourceFile: "Main.c",
        compile: "gcc -O2 -std=c99 Main.c -o Main",
        run: "./Main",
    },
    CPP17: {
        sourceFile: "Main.cpp",
        compile: "g++ -O2 -std=c++17 Main.cpp -o Main",
        run: "./Main",
    },
    JAVA11: {
        sourceFile: "Main.java",
        compile: "javac Main.java",
        run: "java Main",
    },
    PYTHON3: {
        sourceFile: "Main.py",
        run: "python3 Main.py",
    },
    CS: {
        sourceFile: "Main.cs",
        compile: "mcs -optimize+ -out:Main.exe Main.cs",
        run: "mono Main.exe",
    },
};

const DEFAULT_STDOUT_LIMIT_BYTES = 4 * 1024 * 1024;
const DEFAULT_STDERR_LIMIT_BYTES = 2 * 1024 * 1024;

function normalizeOutput(value: string): string {
    return value.replace(/\r\n?/g, "\n");
}

function trimTrailingWhitespace(value: string): string {
    return value.replace(/[ \t\n\r]+$/g, "");
}

function stripAllWhitespace(value: string): string {
    return value.replace(/[ \t\n\r]+/g, "");
}

function formatExecError(result: ExecResult): string {
    return result.stderr || result.stdout || "Unknown error";
}

const timeOutputPrefixes = [
    "Command being timed:",
    "User time (seconds):",
    "System time (seconds):",
    "Percent of CPU this job got:",
    "Elapsed (wall clock) time",
    "Average shared text size (kbytes):",
    "Average unshared data size (kbytes):",
    "Average stack size (kbytes):",
    "Average total size (kbytes):",
    "Maximum resident set size (kbytes):",
    "Average resident set size (kbytes):",
    "Major (requiring I/O) page faults:",
    "Minor (reclaiming a frame) page faults:",
    "Voluntary context switches:",
    "Involuntary context switches:",
    "Swaps:",
    "File system inputs:",
    "File system outputs:",
    "Socket messages sent:",
    "Socket messages received:",
    "Signals delivered:",
    "Page size (bytes):",
    "Exit status:",
    "Command exited with non-zero status",
];

function extractTimeStats(stderr: string): {
    memoryKb: number | null;
    cleanedStderr: string;
} {
    let memoryKb: number | null = null;
    const cleanedLines: string[] = [];
    for (const line of stderr.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("Maximum resident set size (kbytes):")) {
            const raw = trimmed.split(":").slice(1).join(":").trim();
            const parsed = Number(raw);
            if (Number.isFinite(parsed)) {
                memoryKb = parsed;
            }
            continue;
        }
        if (timeOutputPrefixes.some((prefix) => trimmed.startsWith(prefix))) {
            continue;
        }
        cleanedLines.push(line);
    }
    return { memoryKb, cleanedStderr: cleanedLines.join("\n").trimEnd() };
}

function parseGeneratedInputs(output: string): string[] {
    const normalized = normalizeOutput(output).trim();
    if (!normalized) {
        return [];
    }

    try {
        const parsed = JSON.parse(normalized);
        if (
            Array.isArray(parsed) &&
            parsed.every((item) => typeof item === "string")
        ) {
            return parsed as string[];
        }
    } catch {
        // Fall back to delimiter parsing below.
    }

    const lines = normalized.split("\n");
    const inputs: string[] = [];
    let buffer: string[] = [];
    let sawSeparator = false;

    for (const line of lines) {
        if (line.trim() === "---") {
            inputs.push(buffer.join("\n"));
            buffer = [];
            sawSeparator = true;
            continue;
        }
        buffer.push(line);
    }

    if (buffer.length > 0 || sawSeparator) {
        inputs.push(buffer.join("\n"));
    }

    return inputs;
}

async function runProcess(
    command: string,
    args: string[],
    input?: string,
    timeoutMs?: number,
    limits: { stdout: number; stderr: number } = {
        stdout: DEFAULT_STDOUT_LIMIT_BYTES,
        stderr: DEFAULT_STDERR_LIMIT_BYTES,
    },
): Promise<ExecResult> {
    return new Promise((resolve) => {
        let resolved = false;
        const child = spawn(command, args, {
            stdio: ["pipe", "pipe", "pipe"],
        });

        const stdoutState = {
            value: "",
            size: 0,
            truncated: false,
        };
        const stderrState = {
            value: "",
            size: 0,
            truncated: false,
        };
        let timedOut = false;

        const appendLimited = (
            state: { value: string; size: number; truncated: boolean },
            data: Buffer,
            limit: number,
        ) => {
            if (limit <= 0) {
                state.truncated = true;
                return;
            }
            if (state.size >= limit) {
                state.truncated = true;
                return;
            }
            const remaining = limit - state.size;
            if (data.length > remaining) {
                state.value += data.subarray(0, remaining).toString();
                state.size = limit;
                state.truncated = true;
                return;
            }
            state.value += data.toString();
            state.size += data.length;
        };

        child.stdout.on("data", (data) => {
            appendLimited(stdoutState, data, limits.stdout);
        });

        child.stderr.on("data", (data) => {
            appendLimited(stderrState, data, limits.stderr);
        });

        if (input !== undefined) {
            child.stdin.write(input);
        }
        child.stdin.end();

        let timer: NodeJS.Timeout | null = null;
        if (timeoutMs) {
            timer = setTimeout(() => {
                timedOut = true;
                child.kill("SIGKILL");
            }, timeoutMs);
        }

        child.on("error", (err) => {
            if (timer) {
                clearTimeout(timer);
            }
            if (resolved) {
                return;
            }
            resolved = true;
            resolve({
                code: -1,
                stdout: stdoutState.value,
                stderr: `${stderrState.value}${err.message}`,
                timedOut,
                stdoutTruncated: stdoutState.truncated,
                stderrTruncated: stderrState.truncated,
            });
        });

        child.on("close", (code) => {
            if (timer) {
                clearTimeout(timer);
            }
            if (resolved) {
                return;
            }
            resolved = true;
            resolve({
                code: code ?? -1,
                stdout: stdoutState.value,
                stderr: stderrState.value,
                timedOut,
                stdoutTruncated: stdoutState.truncated,
                stderrTruncated: stderrState.truncated,
            });
        });
    });
}

async function dockerRun(
    args: string[],
    input?: string,
    timeoutMs?: number,
): Promise<ExecResult> {
    return runProcess("docker", args, input, timeoutMs);
}

function buildDockerArgs(options: {
    image: string;
    volumeName: string;
    command: string;
    memoryLimitMb: number;
}): string[] {
    return [
        "run",
        "--rm",
        "-i",
        "--network",
        "none",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--pids-limit",
        "64",
        "--read-only",
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,size=64m",
        "--cpus",
        "1",
        "--memory",
        `${options.memoryLimitMb}m`,
        "--memory-swap",
        `${options.memoryLimitMb}m`,
        "-v",
        `${options.volumeName}:/workspace:rw`,
        "-w",
        "/workspace",
        options.image,
        "sh",
        "-c",
        options.command,
    ];
}

async function writeFileToVolume(
    image: string,
    volumeName: string,
    fileName: string,
    content: string,
): Promise<ExecResult> {
    const args = [
        "run",
        "--rm",
        "-i",
        "--network",
        "none",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "-v",
        `${volumeName}:/workspace:rw`,
        "-w",
        "/workspace",
        image,
        "sh",
        "-c",
        `cat > /workspace/${fileName}`,
    ];
    return dockerRun(args, content, 5000);
}

function wrapTimeout(command: string, timeoutMs: number): string {
    const seconds = Math.max(0.001, timeoutMs / 1000);
    const formatted = Number.isInteger(seconds)
        ? String(seconds)
        : seconds.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
    return `timeout -s KILL ${formatted}s ${command}`;
}

function wrapTimedCommand(command: string, timeoutMs: number): string {
    return wrapTimeout(`/usr/bin/time -v ${command}`, timeoutMs);
}

type AggregateStats = {
    runtimeTotalMs: number;
    runtimeSamples: number;
    memoryTotalKb: number;
    memorySamples: number;
};

function createAggregateStats(): AggregateStats {
    return {
        runtimeTotalMs: 0,
        runtimeSamples: 0,
        memoryTotalKb: 0,
        memorySamples: 0,
    };
}

function recordStats(
    stats: AggregateStats,
    runtimeMs: number,
    memoryKb?: number | null,
): void {
    stats.runtimeTotalMs += runtimeMs;
    stats.runtimeSamples += 1;
    if (memoryKb !== null && memoryKb !== undefined) {
        stats.memoryTotalKb += memoryKb;
        stats.memorySamples += 1;
    }
}

function averageStats(stats: AggregateStats): {
    runtimeMs: number | null;
    memoryKb: number | null;
} {
    return {
        runtimeMs:
            stats.runtimeSamples > 0
                ? Math.round(stats.runtimeTotalMs / stats.runtimeSamples)
                : null,
        memoryKb:
            stats.memorySamples > 0
                ? Math.round(stats.memoryTotalKb / stats.memorySamples)
                : null,
    };
}

function buildOutputLimitDetail(result: ExecResult): string {
    const targets: string[] = [];
    if (result.stdoutTruncated) {
        targets.push("표준 출력");
    }
    if (result.stderrTruncated) {
        targets.push("표준 에러");
    }
    if (targets.length === 0) {
        return "출력 제한을 초과했습니다.";
    }
    return `${targets.join(", ")} 출력이 제한을 초과했습니다.`;
}

function createProgressReporter(
    total: number,
    onProgress?: (progress: JudgeProgress) => Promise<void> | void,
) {
    let lastPercent = -1;
    return async (current: number) => {
        if (!onProgress || total <= 0) {
            return;
        }
        const percent = Math.min(100, Math.floor((current / total) * 100));
        if (percent === lastPercent) {
            return;
        }
        lastPercent = percent;
        try {
            await onProgress({ current, total, percent });
        } catch {
            // ignore progress update failures
        }
    };
}

async function createVolume(volumeName: string): Promise<void> {
    const result = await runProcess("docker", ["volume", "create", volumeName]);
    if (result.code !== 0) {
        throw new Error(
            result.stderr || result.stdout || "Failed to create volume",
        );
    }
}

async function removeVolume(volumeName: string): Promise<void> {
    await runProcess("docker", ["volume", "rm", "-f", volumeName]);
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
    const volumeName = `oj-${options.label}-${
        options.submissionId
    }-${Date.now()}`;

    await createVolume(volumeName);

    const writeResult = await writeFileToVolume(
        options.image,
        volumeName,
        config.sourceFile,
        options.code,
    );
    if (writeResult.code !== 0) {
        await removeVolume(volumeName);
        return { error: { stage: "write", result: writeResult } };
    }

    if (config.compile) {
        const compileCommand = wrapTimeout(
            config.compile,
            options.compileTimeoutMs,
        );
        const compileResult = await dockerRun(
            buildDockerArgs({
                image: options.image,
                volumeName,
                command: compileCommand,
                memoryLimitMb: options.memoryLimitMb,
            }),
            undefined,
            options.compileTimeoutMs + 1000,
        );

        if (compileResult.code !== 0 || compileResult.timedOut) {
            await removeVolume(volumeName);
            return { error: { stage: "compile", result: compileResult } };
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
    const runCommand = wrapTimedCommand(
        options.program.config.run,
        options.timeLimitMs,
    );
    const result = await dockerRun(
        buildDockerArgs({
            image: options.image,
            volumeName: options.program.volumeName,
            command: runCommand,
            memoryLimitMb: options.memoryLimitMb,
        }),
        options.input,
        options.timeLimitMs + 1000,
    );
    const { memoryKb, cleanedStderr } = extractTimeStats(result.stderr);
    return { ...result, stderr: cleanedStderr, memoryKb };
}

export async function runSubmission(options: {
    runId: number;
    language: Language;
    code: string;
    problem: Problem;
    input: string;
    image: string;
}): Promise<RunResult> {
    if (!languageConfigs[options.language]) {
        return {
            status: SubmissionStatus.SYSTEM_ERROR,
            message: "지원하지 않는 언어입니다.",
            stdout: "",
            stderr: "",
        };
    }
    if (options.problem.submissionType === "TEXT") {
        return {
            status: SubmissionStatus.SYSTEM_ERROR,
            message: "텍스트 제출 문제는 실행할 수 없습니다.",
            stdout: "",
            stderr: "",
        };
    }

    const timeLimitMs =
        Number.isFinite(options.problem.timeLimitMs) &&
        options.problem.timeLimitMs > 0
            ? options.problem.timeLimitMs
            : 1000;
    const memoryLimitMb = Math.max(64, options.problem.memoryLimitMb || 256);
    const compileTimeoutMs = 10000;

    let program: PreparedProgram | null = null;

    try {
        const prepared = await prepareProgram({
            submissionId: options.runId,
            label: "run",
            language: options.language,
            code: options.code,
            image: options.image,
            memoryLimitMb,
            compileTimeoutMs,
        });

        if ("error" in prepared) {
            const { result, stage } = prepared.error;
            if (stage === "compile") {
                if (result.timedOut || result.code === 124) {
                    return {
                        status: SubmissionStatus.TIME_LIMIT_EXCEEDED,
                        message: "컴파일 시간 초과",
                        stdout: result.stdout,
                        stderr: result.stderr,
                    };
                }
                if (result.code === 137) {
                    return {
                        status: SubmissionStatus.MEMORY_LIMIT_EXCEEDED,
                        message: "컴파일 메모리 초과",
                        stdout: result.stdout,
                        stderr: result.stderr,
                    };
                }
                return {
                    status: SubmissionStatus.COMPILE_ERROR,
                    message: "컴파일 에러",
                    stdout: result.stdout,
                    stderr: result.stderr || result.stdout,
                };
            }
            return {
                status: SubmissionStatus.SYSTEM_ERROR,
                message: "시스템 오류",
                stdout: result.stdout,
                stderr: formatExecError(result),
            };
        }

        program = prepared.program;
        const start = Date.now();
        const runResult = await runProgram({
            program,
            image: options.image,
            input: options.input,
            timeLimitMs,
            memoryLimitMb,
        });
        const runtimeMs = Date.now() - start;

        if (runResult.timedOut || runResult.code === 124) {
            return {
                status: SubmissionStatus.TIME_LIMIT_EXCEEDED,
                message: "시간 초과",
                stdout: runResult.stdout,
                stderr: runResult.stderr,
                runtimeMs,
                memoryKb: runResult.memoryKb ?? null,
            };
        }
        if (runResult.code === 137) {
            return {
                status: SubmissionStatus.MEMORY_LIMIT_EXCEEDED,
                message: "메모리 초과",
                stdout: runResult.stdout,
                stderr: runResult.stderr,
                runtimeMs,
                memoryKb: runResult.memoryKb ?? null,
            };
        }
        if (runResult.code !== 0) {
            return {
                status: SubmissionStatus.RUNTIME_ERROR,
                message: "런타임 에러",
                stdout: runResult.stdout,
                stderr: runResult.stderr || formatExecError(runResult),
                runtimeMs,
                memoryKb: runResult.memoryKb ?? null,
            };
        }
        if (runResult.stdoutTruncated || runResult.stderrTruncated) {
            return {
                status: SubmissionStatus.RUNTIME_ERROR,
                message: "출력 제한 초과",
                stdout: runResult.stdout,
                stderr: runResult.stderr || buildOutputLimitDetail(runResult),
                runtimeMs,
                memoryKb: runResult.memoryKb ?? null,
            };
        }

        return {
            status: SubmissionStatus.ACCEPTED,
            message: "실행 완료",
            stdout: runResult.stdout,
            stderr: runResult.stderr,
            runtimeMs,
            memoryKb: runResult.memoryKb ?? null,
        };
    } catch (error) {
        return {
            status: SubmissionStatus.SYSTEM_ERROR,
            message: "시스템 오류",
            stdout: "",
            stderr: error instanceof Error ? error.message : "Unknown error",
        };
    } finally {
        if (program) {
            await removeVolume(program.volumeName);
        }
    }
}

export async function judgeSubmission(options: {
    submissionId: number;
    language: Language;
    code: string;
    problem: Problem;
    testcases: TestcaseInput[];
    image: string;
    onProgress?: (progress: JudgeProgress) => Promise<void> | void;
}): Promise<JudgeResult> {
    if (options.problem.submissionType === "TEXT") {
        const expectedRaw = options.problem.textAnswer ?? "";
        if (expectedRaw.trim().length === 0) {
            return {
                status: SubmissionStatus.SYSTEM_ERROR,
                message: "시스템 오류",
                detail: "정답 텍스트가 설정되지 않았습니다.",
            };
        }
        const expected = stripAllWhitespace(normalizeOutput(expectedRaw));
        const actual = stripAllWhitespace(normalizeOutput(options.code));
        if (expected === actual) {
            return {
                status: SubmissionStatus.ACCEPTED,
                message: "맞았습니다!",
            };
        }
        return {
            status: SubmissionStatus.WRONG_ANSWER,
            message: "틀렸습니다.",
        };
    }

    const useGeneratedTests =
        options.problem.generatorLanguage &&
        options.problem.generatorCode &&
        options.problem.solutionLanguage &&
        options.problem.solutionCode;
    if (!useGeneratedTests && options.testcases.length === 0) {
        return {
            status: SubmissionStatus.SYSTEM_ERROR,
            message: "시스템 오류",
            detail: "채점 테스트케이스가 없습니다.",
        };
    }
    const timeLimitMs =
        Number.isFinite(options.problem.timeLimitMs) &&
        options.problem.timeLimitMs > 0
            ? options.problem.timeLimitMs
            : 1000;
    const memoryLimitMb = Math.max(64, options.problem.memoryLimitMb || 256);
    const compileTimeoutMs = 10000;
    const stats = createAggregateStats();
    const volumesToCleanup: string[] = [];

    try {
        const submissionPrepared = await prepareProgram({
            submissionId: options.submissionId,
            label: "sub",
            language: options.language,
            code: options.code,
            image: options.image,
            memoryLimitMb,
            compileTimeoutMs,
        });

        if ("error" in submissionPrepared) {
            const { result } = submissionPrepared.error;
            if (submissionPrepared.error.stage === "compile") {
                if (result.timedOut || result.code === 124) {
                    return {
                        status: SubmissionStatus.TIME_LIMIT_EXCEEDED,
                        message: "시간 초과",
                        detail: formatExecError(result),
                    };
                }
                if (result.code === 137) {
                    return {
                        status: SubmissionStatus.MEMORY_LIMIT_EXCEEDED,
                        message: "메모리 초과",
                        detail: formatExecError(result),
                    };
                }
                return {
                    status: SubmissionStatus.COMPILE_ERROR,
                    message: "컴파일 에러",
                    detail: formatExecError(result),
                };
            }
            return {
                status: SubmissionStatus.SYSTEM_ERROR,
                message: "시스템 오류",
                detail: formatExecError(result),
            };
        }

        const submissionProgram = submissionPrepared.program;
        volumesToCleanup.push(submissionProgram.volumeName);

        if (!useGeneratedTests) {
            const total = options.testcases.length;
            const reportProgress = createProgressReporter(
                total,
                options.onProgress,
            );
            for (let index = 0; index < total; index += 1) {
                const testcase = options.testcases[index];
                const start = Date.now();
                const runResult = await runProgram({
                    program: submissionProgram,
                    image: options.image,
                    input: testcase.input,
                    timeLimitMs,
                    memoryLimitMb,
                });
                const elapsed = Date.now() - start;
                recordStats(stats, elapsed, runResult.memoryKb);
                const averages = averageStats(stats);
                await reportProgress(index + 1);

                if (runResult.timedOut || runResult.code === 124) {
                    return {
                        status: SubmissionStatus.TIME_LIMIT_EXCEEDED,
                        message: "시간 초과",
                        runtimeMs: averages.runtimeMs,
                        memoryKb: averages.memoryKb,
                        failedTestcaseOrd: testcase.ord,
                    };
                }
                if (runResult.code === 137) {
                    return {
                        status: SubmissionStatus.MEMORY_LIMIT_EXCEEDED,
                        message: "메모리 초과",
                        runtimeMs: averages.runtimeMs,
                        memoryKb: averages.memoryKb,
                        failedTestcaseOrd: testcase.ord,
                    };
                }

                if (runResult.code !== 0) {
                    return {
                        status: SubmissionStatus.RUNTIME_ERROR,
                        message: "런타임 에러",
                        detail: formatExecError(runResult),
                        runtimeMs: averages.runtimeMs,
                        memoryKb: averages.memoryKb,
                        failedTestcaseOrd: testcase.ord,
                    };
                }
                if (runResult.stdoutTruncated || runResult.stderrTruncated) {
                    return {
                        status: SubmissionStatus.RUNTIME_ERROR,
                        message: "출력 제한 초과",
                        detail: buildOutputLimitDetail(runResult),
                        runtimeMs: averages.runtimeMs,
                        memoryKb: averages.memoryKb,
                        failedTestcaseOrd: testcase.ord,
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
                            message: "출력 형식 오류",
                            detail: "공백/개행만 다른 출력입니다.",
                            runtimeMs: averages.runtimeMs,
                            memoryKb: averages.memoryKb,
                            failedTestcaseOrd: testcase.ord,
                        };
                    }

                    return {
                        status: SubmissionStatus.WRONG_ANSWER,
                        message: "틀렸습니다.",
                        runtimeMs: averages.runtimeMs,
                        memoryKb: averages.memoryKb,
                        failedTestcaseOrd: testcase.ord,
                    };
                }
            }

            const averages = averageStats(stats);
            return {
                status: SubmissionStatus.ACCEPTED,
                message: "맞았습니다!",
                runtimeMs: averages.runtimeMs,
                memoryKb: averages.memoryKb,
            };
        }

        const generatorPrepared = await prepareProgram({
            submissionId: options.submissionId,
            label: "gen",
            language: options.problem.generatorLanguage!,
            code: options.problem.generatorCode!,
            image: options.image,
            memoryLimitMb,
            compileTimeoutMs,
        });

        if ("error" in generatorPrepared) {
            const { result } = generatorPrepared.error;
            return {
                status: SubmissionStatus.SYSTEM_ERROR,
                message: "테스트케이스 생성 실패",
                detail: formatExecError(result),
            };
        }

        const generatorProgram = generatorPrepared.program;
        volumesToCleanup.push(generatorProgram.volumeName);
        const generatorTimeoutMs = Math.max(2000, timeLimitMs);
        const generatedTestcaseCount = 100;
        const generatedInputs: string[] = [];

        for (let attempt = 0; attempt < generatedTestcaseCount; attempt += 1) {
            const generatorRun = await runProgram({
                program: generatorProgram,
                image: options.image,
                input: "",
                timeLimitMs: generatorTimeoutMs,
                memoryLimitMb,
            });

            if (generatorRun.timedOut || generatorRun.code === 124) {
                return {
                    status: SubmissionStatus.SYSTEM_ERROR,
                    message: "테스트케이스 생성 실패",
                    detail: `테스트케이스 생성 시간이 초과되었습니다. (시도 ${
                        attempt + 1
                    }/${generatedTestcaseCount})`,
                };
            }
            if (generatorRun.code === 137) {
                return {
                    status: SubmissionStatus.SYSTEM_ERROR,
                    message: "테스트케이스 생성 실패",
                    detail: `테스트케이스 생성 중 메모리 초과가 발생했습니다. (시도 ${
                        attempt + 1
                    }/${generatedTestcaseCount})`,
                };
            }
            if (generatorRun.code !== 0) {
                return {
                    status: SubmissionStatus.SYSTEM_ERROR,
                    message: "테스트케이스 생성 실패",
                    detail: formatExecError(generatorRun),
                };
            }
            if (generatorRun.stdoutTruncated || generatorRun.stderrTruncated) {
                return {
                    status: SubmissionStatus.SYSTEM_ERROR,
                    message: "테스트케이스 생성 실패",
                    detail: buildOutputLimitDetail(generatorRun),
                };
            }

            const batch = parseGeneratedInputs(generatorRun.stdout);
            if (
                batch.length > 0 &&
                generatedInputs.length < generatedTestcaseCount
            ) {
                const remaining =
                    generatedTestcaseCount - generatedInputs.length;
                generatedInputs.push(...batch.slice(0, remaining));
            }
            if (generatedInputs.length >= generatedTestcaseCount) {
                break;
            }
        }

        if (generatedInputs.length === 0) {
            return {
                status: SubmissionStatus.SYSTEM_ERROR,
                message: "테스트케이스 생성 실패",
                detail: "테스트케이스 생성 출력이 비어 있습니다.",
            };
        }
        if (generatedInputs.length < generatedTestcaseCount) {
            return {
                status: SubmissionStatus.SYSTEM_ERROR,
                message: "테스트케이스 생성 실패",
                detail: `테스트케이스 생성 결과가 ${generatedTestcaseCount}개 미만입니다.`,
            };
        }

        const generatedTestcases = generatedInputs.slice(
            0,
            generatedTestcaseCount,
        );
        const reportProgress = createProgressReporter(
            generatedTestcases.length,
            options.onProgress,
        );

        const solutionPrepared = await prepareProgram({
            submissionId: options.submissionId,
            label: "sol",
            language: options.problem.solutionLanguage!,
            code: options.problem.solutionCode!,
            image: options.image,
            memoryLimitMb,
            compileTimeoutMs,
        });

        if ("error" in solutionPrepared) {
            const { result } = solutionPrepared.error;
            return {
                status: SubmissionStatus.SYSTEM_ERROR,
                message: "정답 코드 실행 실패",
                detail: formatExecError(result),
            };
        }

        const solutionProgram = solutionPrepared.program;
        volumesToCleanup.push(solutionProgram.volumeName);

        for (let index = 0; index < generatedTestcases.length; index += 1) {
            const input = generatedTestcases[index];
            const ord = index + 1;

            const solutionRun = await runProgram({
                program: solutionProgram,
                image: options.image,
                input,
                timeLimitMs,
                memoryLimitMb,
            });

            if (solutionRun.timedOut || solutionRun.code === 124) {
                return {
                    status: SubmissionStatus.SYSTEM_ERROR,
                    message: "정답 코드 실행 실패",
                    detail: `테스트케이스 ${ord}에서 정답 코드가 시간 초과되었습니다.`,
                };
            }
            if (solutionRun.code === 137) {
                return {
                    status: SubmissionStatus.SYSTEM_ERROR,
                    message: "정답 코드 실행 실패",
                    detail: `테스트케이스 ${ord}에서 정답 코드가 메모리 초과되었습니다.`,
                };
            }
            if (solutionRun.code !== 0) {
                return {
                    status: SubmissionStatus.SYSTEM_ERROR,
                    message: "정답 코드 실행 실패",
                    detail: formatExecError(solutionRun),
                };
            }
            if (solutionRun.stdoutTruncated || solutionRun.stderrTruncated) {
                return {
                    status: SubmissionStatus.SYSTEM_ERROR,
                    message: "정답 코드 실행 실패",
                    detail: buildOutputLimitDetail(solutionRun),
                };
            }

            const start = Date.now();
            const submissionRun = await runProgram({
                program: submissionProgram,
                image: options.image,
                input,
                timeLimitMs,
                memoryLimitMb,
            });
            const elapsed = Date.now() - start;
            recordStats(stats, elapsed, submissionRun.memoryKb);
            const averages = averageStats(stats);
            await reportProgress(index + 1);

            if (submissionRun.timedOut || submissionRun.code === 124) {
                return {
                    status: SubmissionStatus.TIME_LIMIT_EXCEEDED,
                    message: "시간 초과",
                    runtimeMs: averages.runtimeMs,
                    memoryKb: averages.memoryKb,
                    failedTestcaseOrd: ord,
                };
            }
            if (submissionRun.code === 137) {
                return {
                    status: SubmissionStatus.MEMORY_LIMIT_EXCEEDED,
                    message: "메모리 초과",
                    runtimeMs: averages.runtimeMs,
                    memoryKb: averages.memoryKb,
                    failedTestcaseOrd: ord,
                };
            }
            if (submissionRun.code !== 0) {
                return {
                    status: SubmissionStatus.RUNTIME_ERROR,
                    message: "런타임 에러",
                    detail: formatExecError(submissionRun),
                    runtimeMs: averages.runtimeMs,
                    memoryKb: averages.memoryKb,
                    failedTestcaseOrd: ord,
                };
            }
            if (
                submissionRun.stdoutTruncated ||
                submissionRun.stderrTruncated
            ) {
                return {
                    status: SubmissionStatus.RUNTIME_ERROR,
                    message: "출력 제한 초과",
                    detail: buildOutputLimitDetail(submissionRun),
                    runtimeMs: averages.runtimeMs,
                    memoryKb: averages.memoryKb,
                    failedTestcaseOrd: ord,
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
                        message: "출력 형식 오류",
                        detail: "공백/개행만 다른 출력입니다.",
                        runtimeMs: averages.runtimeMs,
                        memoryKb: averages.memoryKb,
                        failedTestcaseOrd: ord,
                    };
                }

                return {
                    status: SubmissionStatus.WRONG_ANSWER,
                    message: "틀렸습니다.",
                    runtimeMs: averages.runtimeMs,
                    memoryKb: averages.memoryKb,
                    failedTestcaseOrd: ord,
                };
            }
        }

        const averages = averageStats(stats);
        return {
            status: SubmissionStatus.ACCEPTED,
            message: "맞았습니다!",
            runtimeMs: averages.runtimeMs,
            memoryKb: averages.memoryKb,
        };
    } catch (error) {
        return {
            status: SubmissionStatus.SYSTEM_ERROR,
            message: "시스템 오류",
            detail: error instanceof Error ? error.message : "Unknown error",
        };
    } finally {
        await Promise.all(volumesToCleanup.map((name) => removeVolume(name)));
    }
}
