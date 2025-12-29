import {
    Button,
    Card,
    CardContent,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    apiFetch,
    Submission,
    SubmissionStatus,
    formatDateTime,
    formatMemory,
} from "../../api";
import StatusChip from "../../components/StatusChip";

const statusOptions: Array<SubmissionStatus | ""> = [
    "",
    "PENDING",
    "RUNNING",
    "ACCEPTED",
    "WRONG_ANSWER",
    "COMPILE_ERROR",
    "RUNTIME_ERROR",
    "TIME_LIMIT_EXCEEDED",
    "MEMORY_LIMIT_EXCEEDED",
    "PRESENTATION_ERROR",
    "SYSTEM_ERROR",
];

export default function AdminSubmissionsPage() {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [contestId, setContestId] = useState("");
    const [problemId, setProblemId] = useState("");
    const [userId, setUserId] = useState("");
    const [status, setStatus] = useState<SubmissionStatus | "">("");
    const [search, setSearch] = useState("");
    const [error, setError] = useState<string | null>(null);

    const fetchSubmissions = useCallback(async () => {
        const params = new URLSearchParams();
        if (contestId) params.set("contestId", contestId);
        if (problemId) params.set("problemId", problemId);
        if (userId) params.set("userId", userId);
        if (status) params.set("status", status);
        try {
            const data = await apiFetch<{ submissions: Submission[] }>(
                `/api/admin/submissions?${params.toString()}`
            );
            setSubmissions(data.submissions);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "제출을 불러오지 못했습니다."
            );
        }
    }, [contestId, problemId, status, userId]);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);

    const filtered = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) {
            return submissions;
        }
        return submissions.filter((submission) => {
            const user = submission.user?.username?.toLowerCase() ?? "";
            const problem = submission.problem?.title?.toLowerCase() ?? "";
            return user.includes(keyword) || problem.includes(keyword);
        });
    }, [search, submissions]);

    return (
        <Stack spacing={3}>
            <Typography variant="h4" fontWeight={700}>
                Submissions
            </Typography>
            {error && <Typography color="error">{error}</Typography>}

            <Card
                sx={{
                    borderRadius: 2,
                    boxShadow: "0 16px 40px rgba(16,24,40,0.08)",
                }}
            >
                <CardContent>
                    <Stack spacing={2}>
                        <Typography variant="h6" fontWeight={700}>
                            필터
                        </Typography>
                        <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={2}
                        >
                            <TextField
                                label="Contest ID"
                                value={contestId}
                                onChange={(e) => setContestId(e.target.value)}
                            />
                            <TextField
                                label="Problem ID"
                                value={problemId}
                                onChange={(e) => setProblemId(e.target.value)}
                            />
                            <TextField
                                label="User ID"
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                            />
                            <FormControl sx={{ minWidth: 200 }}>
                                <InputLabel id="status-label">
                                    Status
                                </InputLabel>
                                <Select
                                    labelId="status-label"
                                    value={status}
                                    label="Status"
                                    onChange={(e) =>
                                        setStatus(
                                            e.target.value as
                                                | SubmissionStatus
                                                | ""
                                        )
                                    }
                                >
                                    {statusOptions.map((option) => (
                                        <MenuItem
                                            key={option || "all"}
                                            value={option}
                                        >
                                            {option || "ALL"}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Stack>
                        <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={2}
                            alignItems="center"
                        >
                            <TextField
                                label="검색 (유저/문제)"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                sx={{ flex: 1 }}
                            />
                            <Button
                                variant="contained"
                                onClick={fetchSubmissions}
                            >
                                조회
                            </Button>
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>

            <Card
                sx={{
                    borderRadius: 2,
                    boxShadow: "0 16px 40px rgba(16,24,40,0.08)",
                }}
            >
                <CardContent>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>ID</TableCell>
                                <TableCell>유저</TableCell>
                                <TableCell>문제</TableCell>
                                <TableCell>언어</TableCell>
                                <TableCell>상태</TableCell>
                                <TableCell>메모리</TableCell>
                                <TableCell>제출 시각</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filtered.map((submission) => (
                                <TableRow key={submission.id} hover>
                                    <TableCell>
                                        <Link
                                            to={`/submissions/${submission.id}`}
                                        >
                                            {submission.id}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        {submission.user?.username ?? "-"}
                                    </TableCell>
                                    <TableCell>
                                        {submission.problem?.title ?? "-"}
                                    </TableCell>
                                    <TableCell>
                                        {submission.problem?.submissionType ===
                                        "TEXT"
                                            ? "TEXT"
                                            : submission.language}
                                    </TableCell>
                                    <TableCell>
                                        <StatusChip
                                            status={submission.status}
                                            message={submission.message}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {formatMemory(submission.memoryKb)}
                                    </TableCell>
                                    <TableCell>
                                        {formatDateTime(submission.createdAt)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </Stack>
    );
}
