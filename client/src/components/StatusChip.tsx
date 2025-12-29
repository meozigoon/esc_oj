import { Chip } from "@mui/material";
import { SubmissionStatus } from "../api";

type Props = {
    status: SubmissionStatus;
    message?: string;
};

const statusMap: Record<
    SubmissionStatus,
    {
        label: string;
        color: "default" | "success" | "error" | "warning" | "info";
    }
> = {
    PENDING: { label: "Pending", color: "default" },
    RUNNING: { label: "Running", color: "info" },
    ACCEPTED: { label: "Accepted", color: "success" },
    WRONG_ANSWER: { label: "Wrong Answer", color: "error" },
    COMPILE_ERROR: { label: "Compile Error", color: "error" },
    RUNTIME_ERROR: { label: "Runtime Error", color: "error" },
    TIME_LIMIT_EXCEEDED: { label: "Time Limit", color: "warning" },
    MEMORY_LIMIT_EXCEEDED: { label: "Memory Limit", color: "warning" },
    PRESENTATION_ERROR: { label: "Output Format", color: "warning" },
    SYSTEM_ERROR: { label: "System Error", color: "error" },
};

export default function StatusChip({ status, message }: Props) {
    const info = statusMap[status] ?? statusMap.SYSTEM_ERROR;
    return (
        <Chip
            label={message || info.label}
            color={info.color}
            variant="outlined"
        />
    );
}
