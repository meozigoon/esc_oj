export type SamplePair = {
    input: string;
    output: string;
};

const SAMPLE_LIST_PREFIX = "SAMPLES_JSON:";

function isStringArray(value: unknown): value is string[] {
    return (
        Array.isArray(value) && value.every((item) => typeof item === "string")
    );
}

export function decodeSampleList(raw?: string | null): string[] {
    const value = raw ?? "";
    if (value.length === 0) {
        return [];
    }
    if (value.startsWith(SAMPLE_LIST_PREFIX)) {
        const json = value.slice(SAMPLE_LIST_PREFIX.length);
        try {
            const parsed = JSON.parse(json);
            if (isStringArray(parsed)) {
                return parsed;
            }
        } catch {
            // ignore
        }
    }
    return [value];
}

export function encodeSampleList(values: string[]): string {
    if (values.length === 0) {
        return "";
    }
    if (values.length === 1) {
        return values[0];
    }
    return `${SAMPLE_LIST_PREFIX}${JSON.stringify(values)}`;
}

export function buildSamplePairs(
    sampleInput?: string | null,
    sampleOutput?: string | null,
): SamplePair[] {
    const inputs = decodeSampleList(sampleInput);
    const outputs = decodeSampleList(sampleOutput);
    const count = Math.max(inputs.length, outputs.length);
    if (count === 0) {
        return [];
    }
    return Array.from({ length: count }, (_, index) => ({
        input: inputs[index] ?? "",
        output: outputs[index] ?? "",
    }));
}

export function normalizeSamplePairs(pairs: SamplePair[]): SamplePair[] {
    const normalized = pairs.map((pair) => ({
        input: pair.input ?? "",
        output: pair.output ?? "",
    }));
    let end = normalized.length;
    while (end > 0) {
        const current = normalized[end - 1];
        if (
            current.input.trim().length > 0 ||
            current.output.trim().length > 0
        ) {
            break;
        }
        end -= 1;
    }
    return normalized.slice(0, end);
}

export function getFirstSampleInput(sampleInput?: string | null): string {
    const inputs = decodeSampleList(sampleInput);
    const first = inputs.find((value) => value.trim().length > 0);
    return first ?? "";
}
