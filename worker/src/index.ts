import dotenv from "dotenv";
import { Worker } from "bullmq";
import fs from "fs/promises";
import IORedis from "ioredis";
import path from "path";
import { Language, PrismaClient, SubmissionStatus } from "@prisma/client";
import { JudgeProgress, judgeSubmission, runSubmission } from "./judge";

const repoRoot = path.resolve(__dirname, "..", "..");
const rootEnvPath = path.resolve(repoRoot, ".env");
const envResult = dotenv.config({ path: rootEnvPath });
if (envResult.error) {
    dotenv.config();
}

const prisma = new PrismaClient();
const redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
});
const legacyQueueName = process.env.QUEUE_NAME?.trim();
const runQueueName = process.env.RUN_QUEUE_NAME ?? "run-queue";
const judgeQueueName =
    process.env.JUDGE_QUEUE_NAME ?? legacyQueueName ?? "submission-queue";
const legacyConcurrencyRaw = Number(process.env.WORKER_CONCURRENCY ?? 4);
const legacyConcurrency =
    Number.isFinite(legacyConcurrencyRaw) && legacyConcurrencyRaw > 0
        ? Math.floor(legacyConcurrencyRaw)
        : 4;
const runConcurrencyRaw = Number(
    process.env.RUN_WORKER_CONCURRENCY ?? Math.max(1, legacyConcurrency >> 1),
);
const runConcurrency =
    Number.isFinite(runConcurrencyRaw) && runConcurrencyRaw > 0
        ? Math.floor(runConcurrencyRaw)
        : 2;
const judgeConcurrencyRaw = Number(
    process.env.JUDGE_WORKER_CONCURRENCY ?? legacyConcurrency,
);
const judgeConcurrency =
    Number.isFinite(judgeConcurrencyRaw) && judgeConcurrencyRaw > 0
        ? Math.floor(judgeConcurrencyRaw)
        : legacyConcurrency;
const judgeImage = process.env.JUDGE_IMAGE ?? "oj-runner:latest";
const judgeImageAllowlist = new Set(
    (process.env.JUDGE_IMAGE_ALLOWLIST ?? judgeImage)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
);
if (!judgeImageAllowlist.has(judgeImage)) {
    throw new Error(
        `JUDGE_IMAGE ${judgeImage} is not in JUDGE_IMAGE_ALLOWLIST.`,
    );
}
const dataDir = resolveDataDir(process.env.DATA_DIR);
const maxTestcaseCount = readEnvLimit("MAX_TESTCASE_COUNT", 200);
const progressUpdateStepPercent = Math.min(
    100,
    Math.max(1, readEnvLimit("PROGRESS_UPDATE_STEP_PERCENT", 5)),
);

function resolveDataDir(value?: string): string {
    if (!value) {
        return path.resolve(repoRoot, "data");
    }
    return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

function resolveDataPath(relativePath: string): string {
    const resolved = path.resolve(dataDir, relativePath);
    const relative = path.relative(dataDir, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("Invalid data path.");
    }
    return resolved;
}

function readEnvLimit(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) {
        return fallback;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.floor(parsed);
}

async function readTextFile(relativePath: string): Promise<string> {
    return fs.readFile(resolveDataPath(relativePath), "utf8");
}

async function processRunJob(job: { id?: string; data?: unknown }) {
    const data =
        job.data && typeof job.data === "object"
            ? (job.data as Record<string, unknown>)
            : {};
    const problemId = Number(data.problemId);
    const languageRaw = data.language;
    const code = String(data.code ?? "");
    const input = String(data.input ?? "");

    if (
        !Number.isFinite(problemId) ||
        problemId <= 0 ||
        typeof languageRaw !== "string" ||
        code.trim().length === 0
    ) {
        return {
            status: SubmissionStatus.SYSTEM_ERROR,
            message: "입력값을 확인해 주세요.",
            stdout: "",
            stderr: "",
        };
    }

    const language = languageRaw as Language;
    const problem = await prisma.problem.findUnique({
        where: { id: problemId },
    });

    if (!problem) {
        return {
            status: SubmissionStatus.SYSTEM_ERROR,
            message: "문제를 찾을 수 없습니다.",
            stdout: "",
            stderr: "",
        };
    }

    const runIdRaw = Number(job.id);
    const runId = Number.isFinite(runIdRaw) ? runIdRaw : Date.now();

    return runSubmission({
        runId,
        language,
        code,
        problem,
        input,
        image: judgeImage,
    });
}

function isLegacyRunJobData(data: Record<string, unknown>): boolean {
    const problemId = Number(data.problemId);
    const code = String(data.code ?? "");
    return (
        Number.isFinite(problemId) &&
        problemId > 0 &&
        typeof data.language === "string" &&
        code.trim().length > 0
    );
}

async function processJudgeJob(job: { id?: string; data?: unknown }) {
    const data =
        job.data && typeof job.data === "object"
            ? (job.data as Record<string, unknown>)
            : {};
    const submissionId = Number(data.submissionId);
    if (!Number.isFinite(submissionId) || submissionId <= 0) {
        if (isLegacyRunJobData(data)) {
            // Backward compatibility: old servers may enqueue run jobs to the judge queue.
            return processRunJob(job);
        }
        return;
    }

    try {
        const submission = await prisma.submission.findUnique({
            where: { id: submissionId },
            include: { problem: true },
        });

        if (!submission) {
            return;
        }

        await prisma.submission.update({
            where: { id: submissionId },
            data: { status: SubmissionStatus.RUNNING, message: "채점 중" },
        });

        const testcaseRows = await prisma.testcase.findMany({
            where: { problemId: submission.problemId },
            orderBy: { ord: "asc" },
            take: maxTestcaseCount + 1,
        });
        if (testcaseRows.length > maxTestcaseCount) {
            await prisma.submission.updateMany({
                where: {
                    id: submissionId,
                    status: SubmissionStatus.RUNNING,
                },
                data: {
                    status: SubmissionStatus.SYSTEM_ERROR,
                    message: "시스템 오류",
                    detail: `테스트케이스 수가 제한(${maxTestcaseCount}개)을 초과했습니다.`,
                },
            });
            return;
        }
        const testcases = await Promise.all(
            testcaseRows.map(async (testcase) => {
                const [input, output] = await Promise.all([
                    readTextFile(testcase.inputPath),
                    readTextFile(testcase.outputPath),
                ]);
                return { ord: testcase.ord, input, output };
            }),
        );

        let lastProgressPercent = -1;
        let progressUpdateQueue = Promise.resolve();

        const result = await judgeSubmission({
            submissionId,
            language: submission.language,
            code: submission.code,
            problem: submission.problem,
            testcases,
            image: judgeImage,
            onProgress: (progress: JudgeProgress) => {
                const shouldUpdate =
                    progress.percent === 100 ||
                    progress.percent >=
                        lastProgressPercent + progressUpdateStepPercent;
                if (!shouldUpdate || progress.percent === lastProgressPercent) {
                    return;
                }
                lastProgressPercent = progress.percent;
                progressUpdateQueue = progressUpdateQueue
                    .then(async () => {
                        await prisma.submission.updateMany({
                            where: {
                                id: submissionId,
                                status: SubmissionStatus.RUNNING,
                            },
                            data: {
                                message: `채점 중 (${progress.percent}%)`,
                            },
                        });
                    })
                    .catch(() => {
                        // ignore progress update failures
                    });
            },
        });
        if (
            result.status === SubmissionStatus.SYSTEM_ERROR &&
            result.detail &&
            result.detail.trim().length > 0
        ) {
            console.error(
                `Judge internal detail for submission ${submissionId}: ${result.detail}`,
            );
        }
        const safeDetail =
            result.status === SubmissionStatus.SYSTEM_ERROR
                ? result.detail
                    ? "채점 중 내부 오류가 발생했습니다."
                    : null
                : result.detail ?? null;

        await prisma.submission.update({
            where: { id: submissionId },
            data: {
                status: result.status,
                message: result.message,
                detail: safeDetail,
                runtimeMs: result.runtimeMs ?? null,
                memoryKb: result.memoryKb ?? null,
                failedTestcaseOrd: result.failedTestcaseOrd ?? null,
            },
        });
    } catch (error) {
        console.error(`Judge worker failed on submission ${submissionId}`, error);
        await prisma.submission.updateMany({
            where: { id: submissionId },
            data: {
                status: SubmissionStatus.SYSTEM_ERROR,
                message: "시스템 오류",
                detail: "채점 중 내부 오류가 발생했습니다.",
            },
        });
    }
}

const runWorker = new Worker(runQueueName, processRunJob, {
    connection: redis,
    concurrency: runConcurrency,
});
const judgeWorker = new Worker(judgeQueueName, processJudgeJob, {
    connection: redis,
    concurrency: judgeConcurrency,
});

runWorker.on("failed", (job, err) => {
    console.error(`Run job ${job?.id ?? "unknown"} failed`, err);
});
judgeWorker.on("failed", (job, err) => {
    console.error(`Judge job ${job?.id ?? "unknown"} failed`, err);
});

process.on("SIGINT", async () => {
    await shutdown();
});

process.on("SIGTERM", async () => {
    await shutdown();
});

async function shutdown() {
    await Promise.all([runWorker.close(), judgeWorker.close()]);
    try {
        await redis.quit();
    } catch {
        // ignore shutdown errors
    }
    await prisma.$disconnect();
    process.exit(0);
}
