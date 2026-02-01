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
const queueName = process.env.QUEUE_NAME ?? "submission-queue";
const concurrencyRaw = Number(process.env.WORKER_CONCURRENCY ?? 4);
const concurrency =
    Number.isFinite(concurrencyRaw) && concurrencyRaw > 0 ? concurrencyRaw : 4;
const judgeImage = process.env.JUDGE_IMAGE ?? "oj-runner:latest";
const dataDir = resolveDataDir(process.env.DATA_DIR);

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

async function readTextFile(relativePath: string): Promise<string> {
    return fs.readFile(resolveDataPath(relativePath), "utf8");
}

const worker = new Worker(
    queueName,
    async (job) => {
        if (job.name === "run") {
            const problemId = Number(job.data?.problemId);
            const languageRaw = job.data?.language;
            const code = String(job.data?.code ?? "");
            const input = String(job.data?.input ?? "");

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

        const submissionId = Number(job.data?.submissionId);
        if (!Number.isFinite(submissionId) || submissionId <= 0) {
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
            });

            const testcases = await Promise.all(
                testcaseRows.map(async (testcase) => ({
                    ord: testcase.ord,
                    input: await readTextFile(testcase.inputPath),
                    output: await readTextFile(testcase.outputPath),
                })),
            );

            const result = await judgeSubmission({
                submissionId,
                language: submission.language,
                code: submission.code,
                problem: submission.problem,
                testcases,
                image: judgeImage,
                onProgress: async (progress: JudgeProgress) => {
                    await prisma.submission.updateMany({
                        where: {
                            id: submissionId,
                            status: SubmissionStatus.RUNNING,
                        },
                        data: {
                            message: `채점 중 (${progress.percent}%)`,
                        },
                    });
                },
            });

            await prisma.submission.update({
                where: { id: submissionId },
                data: {
                    status: result.status,
                    message: result.message,
                    detail: result.detail ?? null,
                    runtimeMs: result.runtimeMs ?? null,
                    memoryKb: result.memoryKb ?? null,
                    failedTestcaseOrd: result.failedTestcaseOrd ?? null,
                },
            });
        } catch (error) {
            await prisma.submission.updateMany({
                where: { id: submissionId },
                data: {
                    status: SubmissionStatus.SYSTEM_ERROR,
                    message: "시스템 오류",
                    detail:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
                },
            });
        }
    },
    { connection: redis, concurrency },
);

worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id ?? "unknown"} failed`, err);
});

process.on("SIGINT", async () => {
    await shutdown();
});

process.on("SIGTERM", async () => {
    await shutdown();
});

async function shutdown() {
    await worker.close();
    try {
        await redis.quit();
    } catch {
        // ignore shutdown errors
    }
    await prisma.$disconnect();
    process.exit(0);
}
