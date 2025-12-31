const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const fs = require("fs/promises");
const path = require("path");

const prisma = new PrismaClient();
const dataDir = path.resolve(
    process.env.DATA_DIR || path.join(process.cwd(), "data")
);
const defaultAdminPassword = "admin1234";

function toPosixPath(...segments) {
    return path.posix.join(...segments);
}

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function writeTextFile(relativePath, content) {
    const absolutePath = path.join(dataDir, relativePath);
    await ensureDir(path.dirname(absolutePath));
    await fs.writeFile(absolutePath, content, "utf8");
}

async function main() {
    const rawAdminPassword = process.env.ADMIN_PASSWORD || defaultAdminPassword;
    if (
        process.env.NODE_ENV === "production" &&
        rawAdminPassword === defaultAdminPassword
    ) {
        throw new Error("ADMIN_PASSWORD must be set in production.");
    }
    const adminPassword = await bcrypt.hash(rawAdminPassword, 10);
    const admin = await prisma.user.findUnique({
        where: { username: "admin" },
    });
    if (!admin) {
        await prisma.user.create({
            data: {
                username: "admin",
                passwordHash: adminPassword,
                role: "ADMIN",
            },
        });
    }

    const existingContest = await prisma.contest.findFirst({
        where: { title: "Sample Contest" },
    });
    const contest = existingContest
        ? existingContest
        : await prisma.contest.create({
              data: {
                  title: "Sample Contest",
                  startAt: new Date(Date.now() - 60 * 60 * 1000),
                  endAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
              },
          });

    const existingProblem = await prisma.problem.findFirst({
        where: { title: "A + B", contestId: contest.id },
    });

    const statementContent =
        "## 문제\n두 정수 A와 B가 주어졌을 때, A+B를 출력한다.\n\n## 입력\n첫째 줄에 A와 B가 주어진다.\n## 출력\nA+B를 출력한다.";

    let problem =
        existingProblem ??
        (await prisma.problem.create({
            data: {
                contestId: contest.id,
                title: "A + B",
                statementPath: "pending",
                sampleInput: "1 2\n",
                sampleOutput: "3\n",
                timeLimitMs: 1000,
                memoryLimitMb: 256,
                difficulty: "LOW",
                score: 100,
            },
        }));

    const statementPath = toPosixPath(
        "problems",
        String(problem.id),
        "statement.mdx"
    );
    await writeTextFile(statementPath, statementContent);
    if (problem.statementPath !== statementPath) {
        problem = await prisma.problem.update({
            where: { id: problem.id },
            data: { statementPath },
        });
    }

    await prisma.testcase.deleteMany({ where: { problemId: problem.id } });
    const testcaseRows = [
        { ord: 1, input: "1 2\n", output: "3\n" },
        { ord: 2, input: "10 20\n", output: "30\n" },
    ];

    const testcaseData = [];
    for (const testcase of testcaseRows) {
        const inputPath = toPosixPath(
            "problems",
            String(problem.id),
            "tests",
            `${testcase.ord}.in`
        );
        const outputPath = toPosixPath(
            "problems",
            String(problem.id),
            "tests",
            `${testcase.ord}.out`
        );
        await writeTextFile(inputPath, testcase.input);
        await writeTextFile(outputPath, testcase.output);
        testcaseData.push({
            problemId: problem.id,
            ord: testcase.ord,
            inputPath,
            outputPath,
        });
    }

    await prisma.testcase.createMany({
        data: testcaseData,
    });
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
