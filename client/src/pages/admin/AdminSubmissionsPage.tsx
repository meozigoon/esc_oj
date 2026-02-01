import {
    Button,
    Card,
    CardContent,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
    apiFetch,
    Submission,
    SubmissionStatus,
    formatDateTime,
    formatDuration,
    formatMemory,
} from "../../api";
import PageHeader from "../../components/PageHeader";
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
    const [selected, setSelected] = useState<Submission | null>(null);
    const [codeError, setCodeError] = useState<string | null>(null);
    const [codeLoading, setCodeLoading] = useState(false);
    const codeRequestRef = useRef(0);
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const nextContestId = searchParams.get("contestId") ?? "";
        const nextProblemId = searchParams.get("problemId") ?? "";
        const nextUserId = searchParams.get("userId") ?? "";
        const statusParam = searchParams.get("status") ?? "";
        const nextStatus = statusOptions.includes(
            statusParam as SubmissionStatus,
        )
            ? (statusParam as SubmissionStatus | "")
            : "";

        setContestId((prev) => (prev !== nextContestId ? nextContestId : prev));
        setProblemId((prev) => (prev !== nextProblemId ? nextProblemId : prev));
        setUserId((prev) => (prev !== nextUserId ? nextUserId : prev));
        setStatus((prev) => (prev !== nextStatus ? nextStatus : prev));
    }, [searchParams]);

    const fetchSubmissions = useCallback(async () => {
        setError(null);
        const params = new URLSearchParams();
        if (contestId) params.set("contestId", contestId);
        if (problemId) params.set("problemId", problemId);
        if (userId) params.set("userId", userId);
        if (status) params.set("status", status);
        params.set("limit", "200");
        try {
            const data = await apiFetch<{ submissions: Submission[] }>(
                `/api/admin/submissions?${params.toString()}`,
            );
            setSubmissions(data.submissions);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "제출을 불러오지 못했습니다.",
            );
        }
    }, [contestId, problemId, status, userId]);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);

    const hasRunning = useMemo(
        () =>
            submissions.some((submission) =>
                ["PENDING", "RUNNING"].includes(submission.status),
            ),
        [submissions],
    );

    useEffect(() => {
        if (!hasRunning) {
            return;
        }
        const timer = setInterval(() => {
            fetchSubmissions();
        }, 1000);
        return () => clearInterval(timer);
    }, [fetchSubmissions, hasRunning]);

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

    const handleOpenCode = (submission: Submission) => {
        const requestId = codeRequestRef.current + 1;
        codeRequestRef.current = requestId;
        setSelected(submission);
        setCodeError(null);
        setCodeLoading(true);

        apiFetch<{ submission: Submission }>(
            `/api/submissions/${submission.id}`,
        )
            .then((data) => {
                if (codeRequestRef.current !== requestId) {
                    return;
                }
                setSelected(data.submission);
            })
            .catch((err) => {
                if (codeRequestRef.current !== requestId) {
                    return;
                }
                setCodeError(
                    err instanceof Error
                        ? err.message
                        : "코드를 불러오지 못했습니다.",
                );
            })
            .finally(() => {
                if (codeRequestRef.current !== requestId) {
                    return;
                }
                setCodeLoading(false);
            });
    };

    const handleCloseCode = () => {
        codeRequestRef.current += 1;
        setSelected(null);
        setCodeError(null);
        setCodeLoading(false);
    };

    const hasCode = Boolean(selected?.code && selected.code.trim().length > 0);

    return (
        <Stack spacing={3}>
            <PageHeader title="Submissions" />
            {error && <Typography color="error">{error}</Typography>}

            <Card>
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
                                                | "",
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

            <Card>
                <CardContent>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>유저</TableCell>
                                <TableCell>문제</TableCell>
                                <TableCell>언어</TableCell>
                                <TableCell>상태</TableCell>
                                <TableCell>실행 시간</TableCell>
                                <TableCell>메모리</TableCell>
                                <TableCell>제출 시각</TableCell>
                                <TableCell>코드</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filtered.map((submission) => (
                                <TableRow key={submission.id} hover>
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
                                        {submission.status === "ACCEPTED"
                                            ? formatDuration(
                                                  submission.runtimeMs,
                                              )
                                            : "-"}
                                    </TableCell>
                                    <TableCell>
                                        {submission.status === "ACCEPTED"
                                            ? formatMemory(submission.memoryKb)
                                            : "-"}
                                    </TableCell>
                                    <TableCell>
                                        {formatDateTime(submission.createdAt)}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() =>
                                                handleOpenCode(submission)
                                            }
                                        >
                                            보기
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <Dialog
                open={Boolean(selected)}
                onClose={handleCloseCode}
                fullWidth
                maxWidth="md"
            >
                <DialogTitle>제출 코드</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={1.5}>
                        <Typography variant="body2" color="text.secondary">
                            {selected?.user?.username ?? "-"} /{" "}
                            {selected?.problem?.title ?? "-"} /{" "}
                            {selected?.problem?.submissionType === "TEXT"
                                ? "TEXT"
                                : (selected?.language ?? "-")}
                        </Typography>
                        {codeLoading ? (
                            <Typography color="text.secondary">
                                코드를 불러오는 중...
                            </Typography>
                        ) : codeError ? (
                            <Typography color="error">{codeError}</Typography>
                        ) : hasCode ? (
                            <TextField
                                value={selected?.code ?? ""}
                                multiline
                                minRows={12}
                                fullWidth
                                InputProps={{
                                    readOnly: true,
                                    sx: {
                                        fontFamily:
                                            "Consolas, 'Courier New', monospace",
                                    },
                                }}
                            />
                        ) : (
                            <Typography color="text.secondary">
                                코드가 없습니다.
                            </Typography>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseCode}>닫기</Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}
