import { Chip } from "@mui/material";
import { ProblemDifficulty } from "../api";
import {
    getDifficultyColor,
    getDifficultyLabel,
    getDifficultyTextColor,
} from "../utils/difficulty";

type Props = {
    difficulty?: ProblemDifficulty | null;
    size?: "small" | "medium";
};

export default function DifficultyBadge({ difficulty, size = "small" }: Props) {
    const label = getDifficultyLabel(difficulty);
    const backgroundColor = getDifficultyColor(difficulty);
    const textColor = getDifficultyTextColor(difficulty);

    return (
        <Chip
            label={label}
            size={size}
            sx={{
                backgroundColor,
                color: textColor,
                fontWeight: 700,
                height: size === "small" ? 22 : 26,
            }}
        />
    );
}
