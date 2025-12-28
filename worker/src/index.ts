import dotenv from 'dotenv';
import { Worker } from 'bullmq';
import fs from 'fs/promises';
import IORedis from 'ioredis';
import path from 'path';
import { PrismaClient, SubmissionStatus } from '@prisma/client';
import { judgeSubmission } from './judge';

dotenv.config();

const prisma = new PrismaClient();
const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});
const queueName = process.env.QUEUE_NAME ?? 'submission-queue';
const concurrencyRaw = Number(process.env.WORKER_CONCURRENCY ?? 4);
const concurrency = Number.isFinite(concurrencyRaw) && concurrencyRaw > 0 ? concurrencyRaw : 4;
const judgeImage = process.env.JUDGE_IMAGE ?? 'oj-runner:latest';
const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), '..', 'data'));

function resolveDataPath(relativePath: string): string {
  return path.join(dataDir, relativePath);
}

async function readTextFile(relativePath: string): Promise<string> {
  return fs.readFile(resolveDataPath(relativePath), 'utf8');
}

const worker = new Worker(
  queueName,
  async (job) => {
    const submissionId = Number(job.data?.submissionId);
    if (!submissionId) {
      return;
    }

    try {
      const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        include: { problem: true }
      });

      if (!submission) {
        return;
      }

      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: SubmissionStatus.RUNNING, message: '채점 중' }
      });

      const testcaseRows = await prisma.testcase.findMany({
        where: { problemId: submission.problemId },
        orderBy: { ord: 'asc' }
      });

      const testcases = await Promise.all(
        testcaseRows.map(async (testcase) => ({
          ord: testcase.ord,
          input: await readTextFile(testcase.inputPath),
          output: await readTextFile(testcase.outputPath)
        }))
      );

      const result = await judgeSubmission({
        submissionId,
        language: submission.language,
        code: submission.code,
        problem: submission.problem,
        testcases,
        image: judgeImage
      });

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: result.status,
          message: result.message,
          detail: result.detail ?? null,
          runtimeMs: result.runtimeMs ?? null,
          memoryKb: result.memoryKb ?? null,
          failedTestcaseOrd: result.failedTestcaseOrd ?? null
        }
      });
    } catch (error) {
      await prisma.submission.updateMany({
        where: { id: submissionId },
        data: {
          status: SubmissionStatus.SYSTEM_ERROR,
          message: '시스템 오류',
          detail: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  },
  { connection: redis, concurrency }
);

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id ?? 'unknown'} failed`, err);
});

process.on('SIGINT', async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
