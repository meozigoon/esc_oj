const fs = require("fs/promises");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const repoRoot = path.resolve(__dirname, "..");
const SAMPLE_LIST_PREFIX = "SAMPLES_JSON:";

function decodeSampleList(raw) {
    const value = raw ?? "";
    if (!value) {
        return [];
    }
    if (value.startsWith(SAMPLE_LIST_PREFIX)) {
        const json = value.slice(SAMPLE_LIST_PREFIX.length);
        try {
            const parsed = JSON.parse(json);
            if (Array.isArray(parsed)) {
                return parsed.filter((item) => typeof item === "string");
            }
        } catch {
            // ignore malformed sample JSON
        }
    }
    return [value];
}

function buildSamplePairs(sampleInput, sampleOutput) {
    const inputs = decodeSampleList(sampleInput);
    const outputs = decodeSampleList(sampleOutput);
    const count = Math.max(inputs.length, outputs.length);
    if (!count) {
        return [];
    }
    return Array.from({ length: count }, (_, index) => ({
        input: inputs[index] ?? "",
        output: outputs[index] ?? "",
    }));
}

function parseEnvFile(content) {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
            continue;
        }
        const index = trimmed.indexOf("=");
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim();
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

async function loadEnv() {
    const envPath = path.join(repoRoot, ".env");
    try {
        const content = await fs.readFile(envPath, "utf8");
        parseEnvFile(content);
    } catch (error) {
        // Ignore missing .env
    }
}

function resolveDataDir(value) {
    if (!value) {
        return path.join(repoRoot, "data");
    }
    return path.isAbsolute(value) ? value : path.join(repoRoot, value);
}

function resolveStoredPath(baseDir, storedPath) {
    if (!storedPath) {
        return null;
    }
    if (path.isAbsolute(storedPath)) {
        return storedPath;
    }
    return path.join(baseDir, ...storedPath.split("/"));
}

async function readTextFile(filePath) {
    if (!filePath) {
        return "";
    }
    try {
        return await fs.readFile(filePath, "utf8");
    } catch (error) {
        return "";
    }
}

function formatCodeBlock(lang, content) {
    const trimmed = content ? content.replace(/\s+$/u, "") : "";
    return `\`\`\`${lang}\n${trimmed}\n\`\`\``;
}

function languageFence(language) {
    switch (language) {
        case "C99":
            return "c";
        case "CPP17":
            return "cpp";
        case "JAVA11":
            return "java";
        case "PYTHON3":
            return "python";
        case "CS":
            return "csharp";
        default:
            return "text";
    }
}

function createMeta(problem) {
    const difficulty = problem.difficulty ?? "MID";
    return [
        "---",
        `title: ${problem.title}`,
        `timeLimitMs: ${problem.timeLimitMs}`,
        `memoryLimitMb: ${problem.memoryLimitMb}`,
        `difficulty: ${difficulty}`,
        "---",
        "",
    ].join("\n");
}

function createSamples(problem) {
    const pairs = buildSamplePairs(problem.sampleInput, problem.sampleOutput)
        .map((pair) => ({
            input: pair.input ?? "",
            output: pair.output ?? "",
        }))
        .filter(
            (pair) =>
                pair.input.trim().length > 0 || pair.output.trim().length > 0,
        );
    if (!pairs.length) {
        return "예제 입력과 예제 출력이 제공되지 않았다.\n";
    }
    const parts = [];
    pairs.forEach((pair, index) => {
        const label = index + 1;
        parts.push(`### 예제 입력 ${label}`);
        parts.push(formatCodeBlock("text", pair.input));
        parts.push("");
        parts.push(`### 예제 출력 ${label}`);
        parts.push(formatCodeBlock("text", pair.output));
        parts.push("");
    });
    return `${parts.join("\n")}\n`;
}

async function createTests(problem, dataDir) {
    const testcases = [...problem.testcases].sort((a, b) => a.ord - b.ord);
    if (!testcases.length) {
        return "테스트 케이스가 제공되지 않았다.\n";
    }
    const parts = [];
    for (const testcase of testcases) {
        const inputPath = resolveStoredPath(dataDir, testcase.inputPath);
        const outputPath = resolveStoredPath(dataDir, testcase.outputPath);
        const inputText = await readTextFile(inputPath);
        const outputText = await readTextFile(outputPath);
        parts.push(`### 테스트 케이스 ${testcase.ord}`);
        parts.push("");
        parts.push("**입력**");
        parts.push(formatCodeBlock("text", inputText));
        parts.push("");
        parts.push("**출력**");
        parts.push(formatCodeBlock("text", outputText));
        parts.push("");
    }
    return `${parts.join("\n")}\n`;
}

function createSolution(problem) {
    if (problem.submissionType === "TEXT") {
        const answer = (problem.textAnswer ?? "").trim();
        if (!answer) {
            return "정답이 제공되지 않았다.\n";
        }
        return ["### 정답", "", formatCodeBlock("text", answer), ""].join("\n");
    }
    if (!problem.solutionCode) {
        return "정답 코드가 제공되지 않았다.\n";
    }
    const label = problem.solutionLanguage ?? "TEXT";
    return [
        `### 정답 코드 (${label})`,
        "",
        formatCodeBlock(
            languageFence(problem.solutionLanguage),
            problem.solutionCode,
        ),
        "",
    ].join("\n");
}

function createGenerator(problem) {
    if (!problem.generatorCode) {
        return "생성 코드가 제공되지 않았다.\n";
    }
    const label = problem.generatorLanguage ?? "TEXT";
    return [
        `### 생성 코드 (${label})`,
        "",
        formatCodeBlock(
            languageFence(problem.generatorLanguage),
            problem.generatorCode,
        ),
        "",
    ].join("\n");
}

function createProblemIndex(problems) {
    const lines = ["# 문제 목록"];
    for (const problem of problems) {
        lines.push(
            `- ${problem.id} | ${problem.title} | problems/${problem.id}`,
        );
    }
    return `${lines.join("\n")}\n`;
}

function sortProblems(problems) {
    return [...problems].sort((a, b) => {
        const aMatch = (a.title || "").trim().match(/^([A-Z])\./);
        const bMatch = (b.title || "").trim().match(/^([A-Z])\./);
        const aKey = aMatch ? aMatch[1] : "";
        const bKey = bMatch ? bMatch[1] : "";
        if (aKey && bKey) {
            const letterOrder = aKey.localeCompare(bKey);
            if (letterOrder !== 0) {
                return letterOrder;
            }
        } else if (aKey) {
            return -1;
        } else if (bKey) {
            return 1;
        }
        return a.id - b.id;
    });
}

function createTemplateBlock(problemIndex, problems, contentById) {
    const indent = "        ";
    const parts = [];
    parts.push(`${indent}<template data-md="problem-index">`);
    parts.push(problemIndex.trimEnd());
    parts.push(`${indent}</template>`);

    for (const problem of problems) {
        const content = contentById[problem.id];
        if (!content) {
            continue;
        }
        for (const [key, value] of Object.entries(content)) {
            const safeValue = value.trimEnd();
            parts.push(
                `${indent}<template data-problem="${problem.id}" data-md="${key}">`,
            );
            parts.push(safeValue);
            parts.push(`${indent}</template>`);
        }
    }

    return `${parts.join("\n")}\n`;
}

async function updateIndexHtml(templateBlock) {
    const indexPath = path.join(repoRoot, "oj-preview", "index.html");
    const html = await fs.readFile(indexPath, "utf8");
    const startMarker = '<template data-md="problem-index">';
    const startIndex = html.indexOf(startMarker);
    const scriptMatch = html.match(
        /<script\b[^>]*\bsrc="app\.js"[^>]*><\/script>/,
    );
    if (startIndex === -1 || !scriptMatch) {
        return;
    }
    const scriptIndex = html.indexOf(scriptMatch[0]);
    const before = html.slice(0, startIndex);
    const after = html.slice(scriptIndex);
    const nextHtml = `${before}${templateBlock}\n${after}`;
    await fs.writeFile(indexPath, nextHtml, "utf8");
}

async function main() {
    await loadEnv();
    const dataDir = resolveDataDir(process.env.DATA_DIR);
    const prisma = new PrismaClient();

    try {
        const problems = await prisma.problem.findMany({
            include: { testcases: true },
            orderBy: { id: "asc" },
        });

        const sortedProblems = sortProblems(problems);
        const problemIndex = createProblemIndex(sortedProblems);
        const contentById = {};

        for (const problem of problems) {
            const statementPath = resolveStoredPath(
                dataDir,
                problem.statementPath,
            );
            const statement = await readTextFile(statementPath);
            const problemMd = statement.trim()
                ? `${statement.replace(/\s+$/u, "")}\n`
                : "문제 설명이 제공되지 않았다.\n";

            const metaMd = createMeta(problem);
            const samplesMd = createSamples(problem);
            const testsMd = await createTests(problem, dataDir);
            const solutionMd = createSolution(problem);
            const generatorMd = createGenerator(problem);

            contentById[problem.id] = {
                meta: metaMd,
                problem: problemMd,
                samples: samplesMd,
                tests: testsMd,
                solution: solutionMd,
                generator: generatorMd,
            };
        }

        const templateBlock = createTemplateBlock(
            problemIndex,
            sortedProblems,
            contentById,
        );
        await updateIndexHtml(templateBlock);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
