export function parseTokenSubject(payload: unknown): number | null {
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
    if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
        return null;
    }
    return id;
}

export function isValidPasswordInput(
    password: string,
    limits: { min: number; max: number },
): boolean {
    return (
        password.length >= limits.min &&
        password.length <= limits.max &&
        /\S/.test(password)
    );
}

export function isQueueWaitTimeoutError(error: unknown): boolean {
    return error instanceof Error && /timed out/i.test(error.message);
}
