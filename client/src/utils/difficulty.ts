import { ProblemDifficulty } from "../api";

export const difficultyOptions: Array<{
    value: ProblemDifficulty;
    label: string;
}> = [
    { value: "LOW", label: "하" },
    { value: "LOW_MID", label: "중하" },
    { value: "MID", label: "중" },
    { value: "MID_HIGH", label: "중상" },
    { value: "HIGH", label: "상" },
    { value: "VERY_HIGH", label: "최상" },
];

const difficultyOrder: ProblemDifficulty[] = difficultyOptions.map(
    (option) => option.value
);
const difficultyLabels = new Map<ProblemDifficulty, string>(
    difficultyOptions.map((option) => [option.value, option.label])
);

const green = [22, 163, 74];
const yellow = [250, 204, 21];
const red = [239, 68, 68];

function lerp(a: number, b: number, t: number): number {
    return Math.round(a + (b - a) * t);
}

function mixColor(
    a: number[],
    b: number[],
    t: number
): [number, number, number] {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function resolveDifficultyRgb(
    value?: ProblemDifficulty | null
): [number, number, number] | null {
    if (!value) {
        return null;
    }
    const index = difficultyOrder.indexOf(value);
    if (index < 0) {
        return null;
    }
    if (index <= 2) {
        const t = index / 2;
        return mixColor(green, yellow, t);
    }
    const t = (index - 2) / 3;
    return mixColor(yellow, red, t);
}

export function getDifficultyLabel(value?: ProblemDifficulty | null): string {
    if (!value) {
        return "-";
    }
    return difficultyLabels.get(value) ?? "-";
}

export function getDifficultyColor(value?: ProblemDifficulty | null): string {
    const rgb = resolveDifficultyRgb(value);
    if (!rgb) {
        return "#9ca3af";
    }
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function getDifficultyTextColor(
    value?: ProblemDifficulty | null
): string {
    const rgb = resolveDifficultyRgb(value);
    if (!rgb) {
        return "#111827";
    }
    const luminance =
        (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
    return luminance > 0.6 ? "#111827" : "#ffffff";
}
