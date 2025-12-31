export type Role = "admin" | "user" | "viewer";
export type SubmissionType = "CODE" | "TEXT";
export type ProblemDifficulty =
    | "LOW"
    | "LOW_MID"
    | "MID"
    | "MID_HIGH"
    | "HIGH"
    | "VERY_HIGH";

export type User = {
    id: number;
    username: string;
    role: Role;
};

export type AdminUser = User & {
    createdAt: string;
};

export type ContestSummary = {
    id: number;
    title: string;
    startAt?: string;
    endAt?: string;
};

export type Contest = {
    id: number;
    title: string;
    startAt: string;
    endAt: string;
};

export type ProblemSummary = {
    id: number;
    title: string;
    timeLimitMs?: number;
    memoryLimitMb?: number;
    difficulty?: ProblemDifficulty;
    contestId?: number | null;
    submissionType?: SubmissionType;
};

export type Problem = ProblemSummary & {
    contestId: number | null;
    statementMd: string;
    sampleInput: string;
    sampleOutput: string;
    timeLimitMs: number;
    memoryLimitMb: number;
    difficulty?: ProblemDifficulty;
    score?: number;
    submissionType: SubmissionType;
    textAnswer?: string | null;
    generatorLanguage?: Language | null;
    generatorCode?: string | null;
    solutionLanguage?: Language | null;
    solutionCode?: string | null;
    contest?: Contest | null;
};

export type Testcase = {
    id: number;
    ord: number;
    input: string;
    output: string;
};

export type SubmissionStatus =
    | "PENDING"
    | "RUNNING"
    | "ACCEPTED"
    | "WRONG_ANSWER"
    | "COMPILE_ERROR"
    | "RUNTIME_ERROR"
    | "TIME_LIMIT_EXCEEDED"
    | "MEMORY_LIMIT_EXCEEDED"
    | "PRESENTATION_ERROR"
    | "SYSTEM_ERROR";

export type Submission = {
    id: number;
    language: Language;
    status: SubmissionStatus;
    message: string;
    detail?: string | null;
    createdAt: string;
    runtimeMs?: number | null;
    memoryKb?: number | null;
    failedTestcaseOrd?: number | null;
    code?: string;
    problem?: ProblemSummary | Problem;
    contest?: ContestSummary | Contest | null;
    user?: { id: number; username: string };
};

export type AccessLog = {
    id: number;
    createdAt: string;
    user: { id: number; username: string };
};

export type Language = "C99" | "CPP17" | "JAVA11" | "PYTHON3" | "CS";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
});

export async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const headers = new Headers(options.headers ?? {});
    if (!headers.has("Content-Type") && typeof options.body === "string") {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        credentials: "include",
    });

    if (!response.ok) {
        let message = response.statusText;
        try {
            const data = await response.json();
            message = data.message || message;
        } catch {
            // ignore
        }
        throw new Error(message);
    }

    return response.json() as Promise<T>;
}

export function formatDateTime(value: string | Date): string {
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
        return "-";
    }
    return dateFormatter.format(date);
}

export function formatDuration(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) {
        return "-";
    }
    return `${ms} ms`;
}

export function formatMemory(kb: number | null | undefined): string {
    if (kb === null || kb === undefined) {
        return "-";
    }
    if (kb < 1024) {
        return `${kb} KB`;
    }
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
}
