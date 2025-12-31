import "express-async-errors";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import {
    Language,
    PrismaClient,
    ProblemDifficulty,
    Role,
    SubmissionStatus,
    SubmissionType,
    Prisma,
} from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();
const redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
});
const queueName = process.env.QUEUE_NAME ?? "submission-queue";
const queue = new Queue(queueName, { connection: redis });
const dataDir = path.resolve(
    process.env.DATA_DIR ?? path.join(process.cwd(), "..", "data")
);
const isProd = process.env.NODE_ENV === "production";

const app = express();
const jwtSecret = resolveJwtSecret();
const cookieSecure = process.env.COOKIE_SECURE === "true";
const corsOriginRaw = process.env.CORS_ORIGIN ?? "http://localhost:5173";
const corsOrigins = new Set(
    corsOriginRaw
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
);
if (corsOrigins.size === 0) {
    corsOrigins.add("http://localhost:5173");
}
if (corsOrigins.has("*")) {
    throw new Error(
        'CORS_ORIGIN cannot include "*" when credentials are enabled.'
    );
}

app.disable("x-powered-by");
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || corsOrigins.has(origin)) {
                callback(null, true);
                return;
            }
            callback(null, false);
        },
        credentials: true,
    })
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

type AuthUser = {
    id: number;
    username: string;
    role: Role;
};

type AuthRequest = Request & { user?: AuthUser };

type JwtPayload = {
    sub: number;
    username: string;
    role: Role;
};

const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
});

const submitLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
});

const allowedLanguages = new Set<Language>([
    "C99",
    "CPP17",
    "JAVA11",
    "PYTHON3",
    "CS",
]);
const defaultLanguage: Language = "CPP17";
const allowedDifficulties = new Set<ProblemDifficulty>([
    "LOW",
    "LOW_MID",
    "MID",
    "MID_HIGH",
    "HIGH",
    "VERY_HIGH",
]);
const defaultDifficulty: ProblemDifficulty = "MID";
const defaultScore = 100;
const submissionStatusSet = new Set(Object.values(SubmissionStatus));

function resolveJwtSecret(): string {
    const secret = process.env.JWT_SECRET?.trim();
    if (!secret) {
        if (isProd) {
            throw new Error(
                "JWT_SECRET must be set to a strong value in production."
            );
        }
        return "dev-secret";
    }
    if (isProd && (secret === "dev-secret" || secret === "change-me")) {
        throw new Error(
            "JWT_SECRET must be set to a strong value in production."
        );
    }
    return secret;
}

function toPosixPath(...segments: string[]): string {
    return path.posix.join(...segments);
}

function buildStatementPath(problemId: number): string {
    return toPosixPath("problems", String(problemId), "statement.mdx");
}

function buildTestcasePaths(
    problemId: number,
    ord: number
): { inputPath: string; outputPath: string } {
    const base = toPosixPath("problems", String(problemId), "tests");
    return {
        inputPath: toPosixPath(base, `${ord}.in`),
        outputPath: toPosixPath(base, `${ord}.out`),
    };
}

async function ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
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
    try {
        const absolutePath = resolveDataPath(relativePath);
        return await fs.readFile(absolutePath, "utf8");
    } catch {
        return "";
    }
}

async function writeTextFile(
    relativePath: string,
    content: string
): Promise<void> {
    const absolutePath = resolveDataPath(relativePath);
    await ensureDir(path.dirname(absolutePath));
    await fs.writeFile(absolutePath, content, "utf8");
}

async function removeFile(relativePath: string): Promise<void> {
    try {
        const absolutePath = resolveDataPath(relativePath);
        await fs.unlink(absolutePath);
    } catch {
        // ignore
    }
}

async function removeDir(relativePath: string): Promise<void> {
    try {
        const absolutePath = resolveDataPath(relativePath);
        await fs.rm(absolutePath, { recursive: true, force: true });
    } catch {
        // ignore
    }
}

function getToken(req: Request): string | null {
    const cookieToken = req.cookies?.oj_token as string | undefined;
    if (cookieToken) {
        return cookieToken;
    }
    const header = req.headers.authorization;
    if (!header) {
        return null;
    }
    const [type, token] = header.split(" ");
    if (type === "Bearer" && token) {
        return token;
    }
    return null;
}

function signToken(user: AuthUser): string {
    const payload: JwtPayload = {
        sub: user.id,
        username: user.username,
        role: user.role,
    };
    return jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
}

function parseAuthUser(payload: unknown): AuthUser | null {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    const record = payload as Record<string, unknown>;
    const sub = record.sub;
    const id =
        typeof sub === "number"
            ? sub
            : typeof sub === "string"
            ? Number(sub)
            : NaN;
    if (!Number.isFinite(id)) {
        return null;
    }

    const username = record.username;
    if (typeof username !== "string" || username.length === 0) {
        return null;
    }

    const role = record.role;
    if (role !== "ADMIN" && role !== "USER" && role !== "VIEWER") {
        return null;
    }

    return { id, username, role };
}

app.use((req: AuthRequest, _res: Response, next: NextFunction) => {
    const token = getToken(req);
    if (!token) {
        next();
        return;
    }
    try {
        const payload = jwt.verify(token, jwtSecret);
        req.user = parseAuthUser(payload) ?? undefined;
    } catch {
        req.user = undefined;
    }
    next();
});

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.user) {
        res.status(401).json({ message: "인증이 필요합니다." });
        return;
    }
    next();
}

function isAdminRead(role: Role | undefined): boolean {
    return role === "ADMIN" || role === "VIEWER";
}

function requireAdminRead(req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.user || !isAdminRead(req.user.role)) {
        res.status(403).json({ message: "관리자 권한이 필요합니다." });
        return;
    }
    next();
}

function requireAdminWrite(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    if (!req.user || req.user.role !== "ADMIN") {
        res.status(403).json({ message: "관리자 권한이 필요합니다." });
        return;
    }
    next();
}

function parseNumber(value: unknown): number | null {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function parsePositiveInt(value: unknown): number | null {
    const parsed = parseNumber(value);
    if (parsed === null || !Number.isInteger(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}

function parseNonNegativeInt(value: unknown): number | null {
    const parsed = parseNumber(value);
    if (parsed === null || !Number.isInteger(parsed) || parsed < 0) {
        return null;
    }
    return parsed;
}

function normalizeRole(role: Role) {
    if (role === "ADMIN") {
        return "admin";
    }
    if (role === "VIEWER") {
        return "viewer";
    }
    return "user";
}

function parseRole(role: unknown): Role {
    if (role === "ADMIN" || role === "admin") {
        return "ADMIN";
    }
    if (role === "VIEWER" || role === "viewer") {
        return "VIEWER";
    }
    if (role === "USER" || role === "user") {
        return "USER";
    }
    return "USER";
}

function parseLanguageInput(value: unknown): Language | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    if (allowedLanguages.has(trimmed as Language)) {
        return trimmed as Language;
    }
    return null;
}

function parseSubmissionType(value: unknown): SubmissionType {
    if (value === "TEXT" || value === "text") {
        return "TEXT";
    }
    return "CODE";
}

function parseDifficultyInput(value: unknown): ProblemDifficulty | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    if (allowedDifficulties.has(trimmed as ProblemDifficulty)) {
        return trimmed as ProblemDifficulty;
    }
    return null;
}

function isNotFoundError(error: unknown): boolean {
    return (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
    );
}

app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});

app.post("/api/auth/login", loginLimiter, async (req: AuthRequest, res) => {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "").trim();

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
        res.status(401).json({ message: "로그인 정보가 올바르지 않습니다." });
        return;
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
        res.status(401).json({ message: "로그인 정보가 올바르지 않습니다." });
        return;
    }

    const token = signToken({
        id: user.id,
        username: user.username,
        role: user.role,
    });
    res.cookie("oj_token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: cookieSecure,
    });
    res.json({
        user: {
            id: user.id,
            username: user.username,
            role: normalizeRole(user.role),
        },
    });
});

app.post("/api/auth/logout", (_req: AuthRequest, res) => {
    res.clearCookie("oj_token", {
        httpOnly: true,
        sameSite: "lax",
        secure: cookieSecure,
    });
    res.json({ ok: true });
});

app.get("/api/me", (req: AuthRequest, res) => {
    if (!req.user) {
        res.json({ user: null });
        return;
    }
    res.json({
        user: {
            id: req.user.id,
            username: req.user.username,
            role: normalizeRole(req.user.role),
        },
    });
});

app.post("/api/access-logs", requireAuth, async (req: AuthRequest, res) => {
    const log = await prisma.accessLog.create({
        data: { userId: req.user!.id },
    });
    res.json({ log: { id: log.id, createdAt: log.createdAt } });
});

app.get("/api/contests", requireAuth, async (_req, res) => {
    const contests = await prisma.contest.findMany({
        orderBy: { startAt: "desc" },
    });
    res.json({ contests });
});

app.get("/api/contests/:id", requireAuth, async (req, res) => {
    const contestId = parsePositiveInt(req.params.id);
    if (!contestId) {
        res.status(400).json({ message: "잘못된 contestId입니다." });
        return;
    }
    const contest = await prisma.contest.findUnique({
        where: { id: contestId },
    });
    if (!contest) {
        res.status(404).json({ message: "대회를 찾을 수 없습니다." });
        return;
    }
    res.json({ contest });
});

app.get("/api/contests/:id/problems", requireAuth, async (req, res) => {
    const contestId = parsePositiveInt(req.params.id);
    if (!contestId) {
        res.status(400).json({ message: "잘못된 contestId입니다." });
        return;
    }
    const problems = await prisma.problem.findMany({
        where: { contestId },
        orderBy: { id: "asc" },
        select: {
            id: true,
            title: true,
            difficulty: true,
            timeLimitMs: true,
            memoryLimitMb: true,
            submissionType: true,
        },
    });
    res.json({ problems });
});

app.get("/api/problems/:id", async (req, res) => {
    const problemId = parsePositiveInt(req.params.id);
    if (!problemId) {
        res.status(400).json({ message: "잘못된 problemId입니다." });
        return;
    }
    const problem = await prisma.problem.findUnique({
        where: { id: problemId },
        select: {
            id: true,
            contestId: true,
            title: true,
            statementPath: true,
            sampleInput: true,
            sampleOutput: true,
            difficulty: true,
            timeLimitMs: true,
            memoryLimitMb: true,
            submissionType: true,
            contest: true,
        },
    });
    if (!problem) {
        res.status(404).json({ message: "문제를 찾을 수 없습니다." });
        return;
    }
    const statementMd = await readTextFile(problem.statementPath);
    const { statementPath, ...rest } = problem;
    res.json({ problem: { ...rest, statementMd } });
});

app.post(
    "/api/submissions",
    requireAuth,
    submitLimiter,
    async (req: AuthRequest, res) => {
        const problemId = parsePositiveInt(req.body?.problemId);
        const contestIdInput = parsePositiveInt(req.body?.contestId);
        const languageInput = String(req.body?.language ?? "").trim();
        const code = String(req.body?.code ?? "");

        if (!problemId || code.trim().length === 0) {
            res.status(400).json({ message: "입력값을 확인해 주세요." });
            return;
        }

        const problem = await prisma.problem.findUnique({
            where: { id: problemId },
        });
        if (!problem) {
            res.status(404).json({ message: "문제를 찾을 수 없습니다." });
            return;
        }

        const submissionType = problem.submissionType ?? "CODE";
        let language: Language = defaultLanguage;

        if (submissionType === "TEXT") {
            if (!problem.textAnswer || problem.textAnswer.trim().length === 0) {
                res.status(400).json({
                    message: "정답 텍스트가 설정되지 않았습니다.",
                });
                return;
            }
        } else {
            const parsed = parseLanguageInput(languageInput);
            if (!parsed) {
                res.status(400).json({ message: "입력값을 확인해 주세요." });
                return;
            }
            language = parsed;
        }

        let contestId: number | null =
            contestIdInput ?? problem.contestId ?? null;
        if (problem.contestId && contestId && contestId !== problem.contestId) {
            res.status(400).json({ message: "대회 정보가 일치하지 않습니다." });
            return;
        }

        if (contestId) {
            const contest = await prisma.contest.findUnique({
                where: { id: contestId },
            });
            if (!contest) {
                res.status(404).json({ message: "대회를 찾을 수 없습니다." });
                return;
            }
            const now = new Date();
            if (now < contest.startAt || now > contest.endAt) {
                res.status(403).json({ message: "대회 시간이 아닙니다." });
                return;
            }
        }

        const submission = await prisma.submission.create({
            data: {
                userId: req.user!.id,
                contestId,
                problemId,
                language,
                code,
                status: SubmissionStatus.PENDING,
                message: "채점 대기",
            },
        });

        await queue.add(
            "judge",
            { submissionId: submission.id },
            { removeOnComplete: 100, removeOnFail: 100 }
        );

        res.json({ submissionId: submission.id });
    }
);

app.get("/api/submissions", requireAuth, async (req: AuthRequest, res) => {
    const mine = String(req.query.mine ?? "") === "1";
    const contestId = parsePositiveInt(req.query.contestId);
    const problemId = parsePositiveInt(req.query.problemId);
    const status = req.query.status ? String(req.query.status) : null;
    const userId = parsePositiveInt(req.query.userId);

    const isAdmin = req.user?.role === "ADMIN";

    const where: {
        userId?: number;
        contestId?: number;
        problemId?: number;
        status?: SubmissionStatus;
    } = {};

    if (!isAdmin || mine) {
        where.userId = req.user!.id;
    } else if (userId) {
        where.userId = userId;
    }

    if (contestId) {
        where.contestId = contestId;
    }
    if (problemId) {
        where.problemId = problemId;
    }
    if (status && submissionStatusSet.has(status as SubmissionStatus)) {
        where.status = status as SubmissionStatus;
    }

    const submissions = await prisma.submission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            userId: true,
            language: true,
            status: true,
            message: true,
            createdAt: true,
            runtimeMs: true,
            memoryKb: true,
            problem: {
                select: { id: true, title: true, submissionType: true },
            },
            contest: { select: { id: true, title: true } },
            user: { select: { id: true, username: true } },
        },
    });

    res.json({ submissions });
});

app.get("/api/submissions/:id", requireAuth, async (req: AuthRequest, res) => {
    const submissionId = parsePositiveInt(req.params.id);
    if (!submissionId) {
        res.status(400).json({ message: "잘못된 submissionId입니다." });
        return;
    }

    const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: {
            id: true,
            userId: true,
            language: true,
            status: true,
            message: true,
            detail: true,
            createdAt: true,
            runtimeMs: true,
            memoryKb: true,
            failedTestcaseOrd: true,
            code: true,
            problem: {
                select: { id: true, title: true, submissionType: true },
            },
            contest: { select: { id: true, title: true } },
            user: { select: { id: true, username: true } },
        },
    });

    if (!submission) {
        res.status(404).json({ message: "제출을 찾을 수 없습니다." });
        return;
    }

    if (!isAdminRead(req.user?.role) && submission.userId !== req.user!.id) {
        res.status(403).json({ message: "접근 권한이 없습니다." });
        return;
    }

    res.json({ submission });
});

app.post(
    "/api/submissions/:id/resubmit",
    requireAuth,
    submitLimiter,
    async (req: AuthRequest, res) => {
        const submissionId = parsePositiveInt(req.params.id);
        if (!submissionId) {
            res.status(400).json({ message: "잘못된 submissionId입니다." });
            return;
        }

        const original = await prisma.submission.findUnique({
            where: { id: submissionId },
            include: { contest: true, problem: true },
        });

        if (!original) {
            res.status(404).json({ message: "제출을 찾을 수 없습니다." });
            return;
        }

        if (req.user!.role !== "ADMIN" && original.userId !== req.user!.id) {
            res.status(403).json({ message: "접근 권한이 없습니다." });
            return;
        }

        const languageInput = String(req.body?.language ?? "").trim();
        const code = String(req.body?.code ?? "");
        if (code.trim().length === 0) {
            res.status(400).json({ message: "입력값을 확인해 주세요." });
            return;
        }

        const submissionType = original.problem?.submissionType ?? "CODE";
        let language: Language = defaultLanguage;

        if (submissionType === "TEXT") {
            if (
                !original.problem?.textAnswer ||
                original.problem.textAnswer.trim().length === 0
            ) {
                res.status(400).json({
                    message: "정답 텍스트가 설정되지 않았습니다.",
                });
                return;
            }
        } else {
            const parsed = parseLanguageInput(languageInput);
            if (!parsed) {
                res.status(400).json({ message: "입력값을 확인해 주세요." });
                return;
            }
            language = parsed;
        }

        if (original.contest) {
            const now = new Date();
            if (
                now < original.contest.startAt ||
                now > original.contest.endAt
            ) {
                res.status(403).json({ message: "대회 시간이 아닙니다." });
                return;
            }
        }

        const submission = await prisma.submission.create({
            data: {
                userId: original.userId,
                contestId: original.contestId,
                problemId: original.problemId,
                language,
                code,
                status: SubmissionStatus.PENDING,
                message: "채점 대기",
            },
        });

        await queue.add(
            "judge",
            { submissionId: submission.id },
            { removeOnComplete: 100, removeOnFail: 100 }
        );

        res.json({ submissionId: submission.id });
    }
);

app.get(
    "/api/admin/contests",
    requireAuth,
    requireAdminRead,
    async (_req, res) => {
        const contests = await prisma.contest.findMany({
            orderBy: { startAt: "desc" },
        });
        res.json({ contests });
    }
);

app.post(
    "/api/admin/contests",
    requireAuth,
    requireAdminWrite,
    async (req, res) => {
        const title = String(req.body?.title ?? "").trim();
        const startAt = new Date(String(req.body?.startAt ?? ""));
        const endAt = new Date(String(req.body?.endAt ?? ""));

        if (
            !title ||
            Number.isNaN(startAt.getTime()) ||
            Number.isNaN(endAt.getTime())
        ) {
            res.status(400).json({ message: "입력값을 확인해 주세요." });
            return;
        }
        if (startAt >= endAt) {
            res.status(400).json({
                message: "시작 시간이 종료 시간보다 빨라야 합니다.",
            });
            return;
        }

        const contest = await prisma.contest.create({
            data: { title, startAt, endAt },
        });

        res.json({ contest });
    }
);

app.put(
    "/api/admin/contests/:id",
    requireAuth,
    requireAdminWrite,
    async (req, res) => {
        const contestId = parsePositiveInt(req.params.id);
        if (!contestId) {
            res.status(400).json({ message: "잘못된 contestId입니다." });
            return;
        }

        const title = String(req.body?.title ?? "").trim();
        const startAt = new Date(String(req.body?.startAt ?? ""));
        const endAt = new Date(String(req.body?.endAt ?? ""));

        if (
            !title ||
            Number.isNaN(startAt.getTime()) ||
            Number.isNaN(endAt.getTime())
        ) {
            res.status(400).json({ message: "입력값을 확인해 주세요." });
            return;
        }
        if (startAt >= endAt) {
            res.status(400).json({
                message: "시작 시간이 종료 시간보다 빨라야 합니다.",
            });
            return;
        }

        try {
            const contest = await prisma.contest.update({
                where: { id: contestId },
                data: { title, startAt, endAt },
            });
            res.json({ contest });
        } catch (error) {
            if (isNotFoundError(error)) {
                res.status(404).json({ message: "대회를 찾을 수 없습니다." });
                return;
            }
            throw error;
        }
    }
);

app.delete(
    "/api/admin/contests/:id",
    requireAuth,
    requireAdminWrite,
    async (req, res) => {
        const contestId = parsePositiveInt(req.params.id);
        if (!contestId) {
            res.status(400).json({ message: "잘못된 contestId입니다." });
            return;
        }

        try {
            await prisma.contest.delete({ where: { id: contestId } });
            res.json({ ok: true });
        } catch (error) {
            if (isNotFoundError(error)) {
                res.status(404).json({ message: "대회를 찾을 수 없습니다." });
                return;
            }
            throw error;
        }
    }
);

app.get(
    "/api/admin/users",
    requireAuth,
    requireAdminRead,
    async (_req, res) => {
        const users = await prisma.user.findMany({
            orderBy: { id: "asc" },
            select: { id: true, username: true, role: true, createdAt: true },
        });
        res.json({
            users: users.map((user) => ({
                id: user.id,
                username: user.username,
                role: normalizeRole(user.role),
                createdAt: user.createdAt,
            })),
        });
    }
);

app.post(
    "/api/admin/users",
    requireAuth,
    requireAdminWrite,
    async (req, res) => {
        const username = String(req.body?.username ?? "").trim();
        const password = String(req.body?.password ?? "").trim();
        const role = parseRole(req.body?.role);

        if (username.length < 3 || password.length < 4) {
            res.status(400).json({
                message: "아이디와 비밀번호를 확인해 주세요.",
            });
            return;
        }

        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
            res.status(409).json({ message: "이미 사용 중인 아이디입니다." });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { username, passwordHash, role },
        });

        res.json({
            user: {
                id: user.id,
                username: user.username,
                role: normalizeRole(user.role),
            },
        });
    }
);

app.put(
    "/api/admin/users/:id/password",
    requireAuth,
    requireAdminWrite,
    async (req, res) => {
        const userId = parsePositiveInt(req.params.id);
        if (!userId) {
            res.status(400).json({ message: "잘못된 userId입니다." });
            return;
        }

        const password = String(req.body?.password ?? "").trim();
        if (password.length < 4) {
            res.status(400).json({ message: "비밀번호를 확인해 주세요." });
            return;
        }

        const existing = await prisma.user.findUnique({
            where: { id: userId },
        });
        if (!existing) {
            res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const updated = await prisma.user.update({
            where: { id: userId },
            data: { passwordHash },
        });

        res.json({
            user: {
                id: updated.id,
                username: updated.username,
                role: normalizeRole(updated.role),
            },
        });
    }
);

app.delete(
    "/api/admin/users/:id",
    requireAuth,
    requireAdminWrite,
    async (req, res) => {
        const userId = parsePositiveInt(req.params.id);
        if (!userId) {
            res.status(400).json({ message: "잘못된 userId입니다." });
            return;
        }

        try {
            await prisma.$transaction(async (tx) => {
                await tx.submission.deleteMany({ where: { userId } });
                await tx.accessLog.deleteMany({ where: { userId } });
                await tx.user.delete({ where: { id: userId } });
            });
            res.json({ ok: true });
        } catch (error) {
            if (isNotFoundError(error)) {
                res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
                return;
            }
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2003"
            ) {
                res.status(409).json({
                    message:
                        "연관 데이터가 남아 있어 삭제할 수 없습니다. 잠시 후 다시 시도해 주세요.",
                });
                return;
            }
            throw error;
        }
    }
);

app.get(
    "/api/admin/problems",
    requireAuth,
    requireAdminRead,
    async (_req, res) => {
        const problems = await prisma.problem.findMany({
            orderBy: { id: "asc" },
            include: { contest: true },
        });
        const withStatements = await Promise.all(
            problems.map(async (problem) => {
                const statementMd = await readTextFile(problem.statementPath);
                const { statementPath, ...rest } = problem;
                return { ...rest, statementMd };
            })
        );
        res.json({ problems: withStatements });
    }
);

app.get(
    "/api/admin/problems/:id",
    requireAuth,
    requireAdminRead,
    async (req, res) => {
        const problemId = parsePositiveInt(req.params.id);
        if (!problemId) {
            res.status(400).json({ message: "잘못된 problemId입니다." });
            return;
        }

        const problem = await prisma.problem.findUnique({
            where: { id: problemId },
            include: { contest: true },
        });
        if (!problem) {
            res.status(404).json({ message: "문제를 찾을 수 없습니다." });
            return;
        }

        const statementMd = await readTextFile(problem.statementPath);
        const { statementPath, ...rest } = problem;
        res.json({ problem: { ...rest, statementMd } });
    }
);

app.post(
    "/api/admin/problems",
    requireAuth,
    requireAdminWrite,
    async (req, res) => {
        const title = String(req.body?.title ?? "").trim();
        const statementMd = String(req.body?.statementMd ?? "");
        const sampleInput = String(req.body?.sampleInput ?? "");
        const sampleOutput = String(req.body?.sampleOutput ?? "");
        const timeLimitMs = parsePositiveInt(req.body?.timeLimitMs);
        const memoryLimitMb = parsePositiveInt(req.body?.memoryLimitMb);
        const scoreRaw = req.body?.score;
        const scoreInput =
            scoreRaw === undefined || scoreRaw === null
                ? null
                : parseNonNegativeInt(scoreRaw);
        const contestId = parsePositiveInt(req.body?.contestId);
        const submissionType = parseSubmissionType(req.body?.submissionType);
        const difficulty =
            parseDifficultyInput(req.body?.difficulty) ?? defaultDifficulty;
        const textAnswer = String(req.body?.textAnswer ?? "");
        const generatorLanguage = parseLanguageInput(
            req.body?.generatorLanguage
        );
        const generatorCode = String(req.body?.generatorCode ?? "");
        const solutionLanguage = parseLanguageInput(req.body?.solutionLanguage);
        const solutionCode = String(req.body?.solutionCode ?? "");

        const hasGeneratorCode = generatorCode.trim().length > 0;
        const hasSolutionCode = solutionCode.trim().length > 0;

        if (
            scoreRaw !== undefined &&
            scoreRaw !== null &&
            scoreInput === null
        ) {
            res.status(400).json({ message: "입력값을 확인해 주세요." });
            return;
        }

        if (submissionType === "CODE") {
            if (
                (hasGeneratorCode && !generatorLanguage) ||
                (!hasGeneratorCode && generatorLanguage)
            ) {
                res.status(400).json({
                    message:
                        "테스트케이스 생성 코드와 언어를 함께 입력해 주세요.",
                });
                return;
            }

            if (
                (hasSolutionCode && !solutionLanguage) ||
                (!hasSolutionCode && solutionLanguage)
            ) {
                res.status(400).json({
                    message: "정답 코드와 언어를 함께 입력해 주세요.",
                });
                return;
            }
            if (hasGeneratorCode !== hasSolutionCode) {
                res.status(400).json({
                    message:
                        "테스트케이스 생성 코드와 정답 코드는 함께 입력해야 합니다.",
                });
                return;
            }
        } else if (textAnswer.trim().length === 0) {
            res.status(400).json({ message: "정답 텍스트를 입력해 주세요." });
            return;
        }

        if (
            !title ||
            !statementMd ||
            timeLimitMs === null ||
            memoryLimitMb === null
        ) {
            res.status(400).json({ message: "입력값을 확인해 주세요." });
            return;
        }

        const score = scoreInput ?? defaultScore;

        let problem = await prisma.problem.create({
            data: {
                title,
                statementPath: "pending",
                sampleInput,
                sampleOutput,
                difficulty,
                score,
                timeLimitMs,
                memoryLimitMb,
                contestId: contestId ?? null,
                submissionType,
                textAnswer: submissionType === "TEXT" ? textAnswer : null,
                generatorLanguage:
                    submissionType === "CODE" && hasGeneratorCode
                        ? generatorLanguage
                        : null,
                generatorCode:
                    submissionType === "CODE" && hasGeneratorCode
                        ? generatorCode
                        : null,
                solutionLanguage:
                    submissionType === "CODE" && hasSolutionCode
                        ? solutionLanguage
                        : null,
                solutionCode:
                    submissionType === "CODE" && hasSolutionCode
                        ? solutionCode
                        : null,
            },
        });

        const statementPath = buildStatementPath(problem.id);
        try {
            await writeTextFile(statementPath, statementMd);
            problem = await prisma.problem.update({
                where: { id: problem.id },
                data: { statementPath },
            });
        } catch (error) {
            await prisma.problem.delete({ where: { id: problem.id } });
            res.status(500).json({ message: "문제 파일 저장에 실패했습니다." });
            return;
        }

        const { statementPath: _statementPath, ...rest } = problem;
        res.json({ problem: { ...rest, statementMd } });
    }
);

app.put(
    "/api/admin/problems/:id",
    requireAuth,
    requireAdminWrite,
    async (req, res) => {
        const problemId = parsePositiveInt(req.params.id);
        if (!problemId) {
            res.status(400).json({ message: "잘못된 problemId입니다." });
            return;
        }

        const title = String(req.body?.title ?? "").trim();
        const statementMd = String(req.body?.statementMd ?? "");
        const sampleInput = String(req.body?.sampleInput ?? "");
        const sampleOutput = String(req.body?.sampleOutput ?? "");
        const timeLimitMs = parsePositiveInt(req.body?.timeLimitMs);
        const memoryLimitMb = parsePositiveInt(req.body?.memoryLimitMb);
        const scoreRaw = req.body?.score;
        const scoreInput =
            scoreRaw === undefined || scoreRaw === null
                ? null
                : parseNonNegativeInt(scoreRaw);
        const contestId = parsePositiveInt(req.body?.contestId);
        const submissionType = parseSubmissionType(req.body?.submissionType);
        const difficultyInput = parseDifficultyInput(req.body?.difficulty);
        const textAnswer = String(req.body?.textAnswer ?? "");
        const generatorLanguage = parseLanguageInput(
            req.body?.generatorLanguage
        );
        const generatorCode = String(req.body?.generatorCode ?? "");
        const solutionLanguage = parseLanguageInput(req.body?.solutionLanguage);
        const solutionCode = String(req.body?.solutionCode ?? "");

        const hasGeneratorCode = generatorCode.trim().length > 0;
        const hasSolutionCode = solutionCode.trim().length > 0;

        if (
            scoreRaw !== undefined &&
            scoreRaw !== null &&
            scoreInput === null
        ) {
            res.status(400).json({ message: "입력값을 확인해 주세요." });
            return;
        }

        if (submissionType === "CODE") {
            if (
                (hasGeneratorCode && !generatorLanguage) ||
                (!hasGeneratorCode && generatorLanguage)
            ) {
                res.status(400).json({
                    message:
                        "테스트케이스 생성 코드와 언어를 함께 입력해 주세요.",
                });
                return;
            }

            if (
                (hasSolutionCode && !solutionLanguage) ||
                (!hasSolutionCode && solutionLanguage)
            ) {
                res.status(400).json({
                    message: "정답 코드와 언어를 함께 입력해 주세요.",
                });
                return;
            }
            if (hasGeneratorCode !== hasSolutionCode) {
                res.status(400).json({
                    message:
                        "테스트케이스 생성 코드와 정답 코드는 함께 입력해야 합니다.",
                });
                return;
            }
        } else if (textAnswer.trim().length === 0) {
            res.status(400).json({ message: "정답 텍스트를 입력해 주세요." });
            return;
        }

        if (
            !title ||
            !statementMd ||
            timeLimitMs === null ||
            memoryLimitMb === null
        ) {
            res.status(400).json({ message: "입력값을 확인해 주세요." });
            return;
        }

        const existing = await prisma.problem.findUnique({
            where: { id: problemId },
        });
        if (!existing) {
            res.status(404).json({ message: "문제를 찾을 수 없습니다." });
            return;
        }

        const statementPath =
            existing.statementPath || buildStatementPath(problemId);
        try {
            await writeTextFile(statementPath, statementMd);
        } catch {
            res.status(500).json({ message: "문제 파일 저장에 실패했습니다." });
            return;
        }

        const problem = await prisma.problem.update({
            where: { id: problemId },
            data: {
                title,
                statementPath,
                sampleInput,
                sampleOutput,
                difficulty: difficultyInput ?? existing.difficulty,
                score: scoreInput ?? existing.score,
                timeLimitMs,
                memoryLimitMb,
                contestId: contestId ?? null,
                submissionType,
                textAnswer: submissionType === "TEXT" ? textAnswer : null,
                generatorLanguage:
                    submissionType === "CODE" && hasGeneratorCode
                        ? generatorLanguage
                        : null,
                generatorCode:
                    submissionType === "CODE" && hasGeneratorCode
                        ? generatorCode
                        : null,
                solutionLanguage:
                    submissionType === "CODE" && hasSolutionCode
                        ? solutionLanguage
                        : null,
                solutionCode:
                    submissionType === "CODE" && hasSolutionCode
                        ? solutionCode
                        : null,
            },
        });

        const { statementPath: _statementPath, ...rest } = problem;
        res.json({ problem: { ...rest, statementMd } });
    }
);

app.delete(
    "/api/admin/problems/:id",
    requireAuth,
    requireAdminWrite,
    async (req, res) => {
        const problemId = parsePositiveInt(req.params.id);
        if (!problemId) {
            res.status(400).json({ message: "잘못된 problemId입니다." });
            return;
        }

        try {
            await prisma.problem.delete({ where: { id: problemId } });
            await removeDir(toPosixPath("problems", String(problemId)));
            res.json({ ok: true });
        } catch (error) {
            if (isNotFoundError(error)) {
                res.status(404).json({ message: "문제를 찾을 수 없습니다." });
                return;
            }
            throw error;
        }
    }
);

app.get(
    "/api/admin/problems/:id/testcases",
    requireAuth,
    requireAdminRead,
    async (req, res) => {
        const problemId = parsePositiveInt(req.params.id);
        if (!problemId) {
            res.status(400).json({ message: "잘못된 problemId입니다." });
            return;
        }

        const testcases = await prisma.testcase.findMany({
            where: { problemId },
            orderBy: { ord: "asc" },
        });
        const enriched = await Promise.all(
            testcases.map(async (testcase) => ({
                id: testcase.id,
                ord: testcase.ord,
                input: await readTextFile(testcase.inputPath),
                output: await readTextFile(testcase.outputPath),
            }))
        );
        res.json({ testcases: enriched });
    }
);

app.post(
    "/api/admin/problems/:id/testcases",
    requireAuth,
    requireAdminWrite,
    async (req, res) => {
        const problemId = parsePositiveInt(req.params.id);
        if (!problemId) {
            res.status(400).json({ message: "잘못된 problemId입니다." });
            return;
        }

        const problem = await prisma.problem.findUnique({
            where: { id: problemId },
        });
        if (!problem) {
            res.status(404).json({ message: "문제를 찾을 수 없습니다." });
            return;
        }

        const input = String(req.body?.input ?? "");
        const output = String(req.body?.output ?? "");
        const ordInput = parsePositiveInt(req.body?.ord);

        let ord = ordInput ?? null;
        if (!ord) {
            const last = await prisma.testcase.findFirst({
                where: { problemId },
                orderBy: { ord: "desc" },
            });
            ord = last ? last.ord + 1 : 1;
        }

        const existing = await prisma.testcase.findFirst({
            where: { problemId, ord },
        });
        if (existing) {
            res.status(409).json({ message: "이미 존재하는 순서입니다." });
            return;
        }

        const { inputPath, outputPath } = buildTestcasePaths(problemId, ord);
        await writeTextFile(inputPath, input);
        await writeTextFile(outputPath, output);

        let testcase;
        try {
            testcase = await prisma.testcase.create({
                data: { problemId, ord, inputPath, outputPath },
            });
        } catch (error) {
            await removeFile(inputPath);
            await removeFile(outputPath);
            throw error;
        }

        res.json({
            testcase: { id: testcase.id, ord: testcase.ord, input, output },
        });
    }
);

app.put(
    "/api/admin/problems/:id/testcases/:testcaseId",
    requireAuth,
    requireAdminWrite,
    async (req, res) => {
        const problemId = parsePositiveInt(req.params.id);
        const testcaseId = parsePositiveInt(req.params.testcaseId);
        if (!problemId || !testcaseId) {
            res.status(400).json({ message: "잘못된 요청입니다." });
            return;
        }

        const input = String(req.body?.input ?? "");
        const output = String(req.body?.output ?? "");
        const ord = parsePositiveInt(req.body?.ord);

        if (!ord) {
            res.status(400).json({ message: "입력값을 확인해 주세요." });
            return;
        }

        const existing = await prisma.testcase.findUnique({
            where: { id: testcaseId },
        });
        if (!existing || existing.problemId !== problemId) {
            res.status(404).json({
                message: "테스트케이스를 찾을 수 없습니다.",
            });
            return;
        }

        const conflict = await prisma.testcase.findFirst({
            where: {
                problemId,
                ord,
                NOT: { id: testcaseId },
            },
        });
        if (conflict) {
            res.status(409).json({ message: "이미 존재하는 순서입니다." });
            return;
        }

        const { inputPath, outputPath } = buildTestcasePaths(problemId, ord);
        await writeTextFile(inputPath, input);
        await writeTextFile(outputPath, output);

        const testcase = await prisma.testcase.update({
            where: { id: testcaseId },
            data: { ord, inputPath, outputPath },
        });

        if (existing.inputPath !== inputPath) {
            await removeFile(existing.inputPath);
        }
        if (existing.outputPath !== outputPath) {
            await removeFile(existing.outputPath);
        }

        res.json({
            testcase: { id: testcase.id, ord: testcase.ord, input, output },
        });
    }
);

app.delete(
    "/api/admin/problems/:id/testcases/:testcaseId",
    requireAuth,
    requireAdminWrite,
    async (req, res) => {
        const testcaseId = parsePositiveInt(req.params.testcaseId);
        if (!testcaseId) {
            res.status(400).json({ message: "잘못된 요청입니다." });
            return;
        }

        const testcase = await prisma.testcase.findUnique({
            where: { id: testcaseId },
        });
        if (!testcase) {
            res.status(404).json({
                message: "테스트케이스를 찾을 수 없습니다.",
            });
            return;
        }

        await prisma.testcase.delete({ where: { id: testcaseId } });
        await removeFile(testcase.inputPath);
        await removeFile(testcase.outputPath);
        res.json({ ok: true });
    }
);

app.get(
    "/api/admin/submissions",
    requireAuth,
    requireAdminRead,
    async (req, res) => {
        const contestId = parsePositiveInt(req.query.contestId);
        const problemId = parsePositiveInt(req.query.problemId);
        const userId = parsePositiveInt(req.query.userId);
        const status = req.query.status ? String(req.query.status) : null;

        const where: {
            contestId?: number;
            problemId?: number;
            userId?: number;
            status?: SubmissionStatus;
        } = {};

        if (contestId) {
            where.contestId = contestId;
        }
        if (problemId) {
            where.problemId = problemId;
        }
        if (userId) {
            where.userId = userId;
        }
        if (status && submissionStatusSet.has(status as SubmissionStatus)) {
            where.status = status as SubmissionStatus;
        }

        const submissions = await prisma.submission.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { id: true, username: true } },
                problem: {
                    select: { id: true, title: true, submissionType: true },
                },
                contest: { select: { id: true, title: true } },
            },
        });

        res.json({ submissions });
    }
);

app.get(
    "/api/admin/summary/by-user",
    requireAuth,
    requireAdminRead,
    async (req, res) => {
        const contestId = parsePositiveInt(req.query.contestId);

        if (contestId) {
            const rows = await prisma.$queryRaw<
                Array<{
                    id: number;
                    username: string;
                    total: number;
                    accepted: number;
                }>
            >`
      SELECT u.id, u.username,
        COUNT(s.id)::int AS total,
        SUM(CASE WHEN s.status = 'ACCEPTED' THEN 1 ELSE 0 END)::int AS accepted
      FROM "Submission" s
      JOIN "User" u ON u.id = s."userId"
      WHERE s."contestId" = ${contestId}
      GROUP BY u.id, u.username
      ORDER BY accepted DESC, total DESC, u.username ASC
    `;
            res.json({ rows });
            return;
        }

        const rows = await prisma.$queryRaw<
            Array<{
                id: number;
                username: string;
                total: number;
                accepted: number;
            }>
        >`
    SELECT u.id, u.username,
      COUNT(s.id)::int AS total,
      SUM(CASE WHEN s.status = 'ACCEPTED' THEN 1 ELSE 0 END)::int AS accepted
    FROM "Submission" s
    JOIN "User" u ON u.id = s."userId"
    GROUP BY u.id, u.username
    ORDER BY accepted DESC, total DESC, u.username ASC
  `;

        res.json({ rows });
    }
);

app.get(
    "/api/admin/summary/by-problem",
    requireAuth,
    requireAdminRead,
    async (req, res) => {
        const contestId = parsePositiveInt(req.query.contestId);

        if (contestId) {
            const rows = await prisma.$queryRaw<
                Array<{
                    id: number;
                    title: string;
                    total: number;
                    accepted: number;
                }>
            >`
      SELECT p.id, p.title,
        COUNT(s.id)::int AS total,
        SUM(CASE WHEN s.status = 'ACCEPTED' THEN 1 ELSE 0 END)::int AS accepted
      FROM "Submission" s
      JOIN "Problem" p ON p.id = s."problemId"
      WHERE s."contestId" = ${contestId}
      GROUP BY p.id, p.title
      ORDER BY accepted DESC, total DESC, p.title ASC
    `;
            res.json({ rows });
            return;
        }

        const rows = await prisma.$queryRaw<
            Array<{
                id: number;
                title: string;
                total: number;
                accepted: number;
            }>
        >`
    SELECT p.id, p.title,
      COUNT(s.id)::int AS total,
      SUM(CASE WHEN s.status = 'ACCEPTED' THEN 1 ELSE 0 END)::int AS accepted
    FROM "Submission" s
    JOIN "Problem" p ON p.id = s."problemId"
    GROUP BY p.id, p.title
    ORDER BY accepted DESC, total DESC, p.title ASC
  `;

        res.json({ rows });
    }
);

app.get(
    "/api/admin/leaderboard",
    requireAuth,
    requireAdminRead,
    async (req, res) => {
        const contestId = parsePositiveInt(req.query.contestId);
        if (!contestId) {
            res.status(400).json({ message: "잘못된 contestId입니다." });
            return;
        }

        const contest = await prisma.contest.findUnique({
            where: { id: contestId },
            select: { id: true },
        });
        if (!contest) {
            res.status(404).json({ message: "대회를 찾을 수 없습니다." });
            return;
        }

        const rows = await prisma.$queryRaw<
            Array<{
                rank: number;
                id: number;
                username: string;
                score: number;
                wrongs: number;
            }>
        >`
      WITH participants AS (
        SELECT DISTINCT s."userId"
        FROM "Submission" s
        WHERE s."contestId" = ${contestId}
      ),
      accepted AS (
        SELECT DISTINCT s."userId", s."problemId"
        FROM "Submission" s
        WHERE s."contestId" = ${contestId}
          AND s.status = 'ACCEPTED'
      ),
      scores AS (
        SELECT a."userId", SUM(p.score)::int AS score
        FROM accepted a
        JOIN "Problem" p ON p.id = a."problemId"
        GROUP BY a."userId"
      ),
      wrongs AS (
        SELECT s."userId", COUNT(*)::int AS wrongs
        FROM "Submission" s
        WHERE s."contestId" = ${contestId}
          AND s.status IN (
            'WRONG_ANSWER',
            'COMPILE_ERROR',
            'RUNTIME_ERROR',
            'TIME_LIMIT_EXCEEDED',
            'MEMORY_LIMIT_EXCEEDED',
            'PRESENTATION_ERROR'
          )
        GROUP BY s."userId"
      )
      SELECT
        ROW_NUMBER() OVER (
          ORDER BY COALESCE(scores.score, 0) DESC,
                   COALESCE(wrongs.wrongs, 0) ASC,
                   u.username ASC
        )::int AS rank,
        u.id,
        u.username,
        COALESCE(scores.score, 0)::int AS score,
        COALESCE(wrongs.wrongs, 0)::int AS wrongs
      FROM participants
      JOIN "User" u ON u.id = participants."userId"
      LEFT JOIN scores ON scores."userId" = u.id
      LEFT JOIN wrongs ON wrongs."userId" = u.id
      ORDER BY score DESC, wrongs ASC, u.username ASC
    `;

        res.json({ rows });
    }
);

app.get(
    "/api/admin/access-logs",
    requireAuth,
    requireAdminRead,
    async (_req, res) => {
        const logs = await prisma.accessLog.findMany({
            orderBy: { createdAt: "desc" },
            include: { user: { select: { id: true, username: true } } },
        });
        res.json({ logs });
    }
);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
    console.log(`Server listening on ${port}`);
});

async function shutdown() {
    try {
        await queue.close();
    } catch {
        // ignore shutdown errors
    }
    try {
        await redis.quit();
    } catch {
        // ignore shutdown errors
    }
    await prisma.$disconnect();
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
