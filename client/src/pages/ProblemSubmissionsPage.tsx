import {
    Box,
    Button,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    apiFetch,
    Problem,
    Submission,
    formatDateTime,
    formatDuration,
    formatMemory,
} from "../api";
import StatusChip from "../components/StatusChip";

export default function ProblemSubmissionsPage() {
    const { id } = useParams();
    const problemId = Number(id);
    const [problem, setProblem] = useState<Problem | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [error, setError] = useState<string | null>(null);

    const fetchProblem = useCallback(() => {
        if (!problemId) {
            return;
        }
        setError(null);
        apiFetch<{ problem: Problem }>(`/api/problems/${problemId}`)
            .then((data) => setProblem(data.problem))
            .catch((err) =>
                setError(
                    err instanceof Error
                        ? err.message
                        : "문제를 불러오지 못했습니다."
                )
            );
    }, [problemId]);

    const fetchSubmissions = useCallback(() => {
        if (!problemId) {
            return;
        }
        setError(null);
        apiFetch<{ submissions: Submission[] }>(
            `/api/submissions?problemId=${problemId}`
        )
            .then((data) => setSubmissions(data.submissions))
            .catch((err) =>
                setError(
                    err instanceof Error
                        ? err.message
                        : "제출을 불러오지 못했습니다."
                )
            );
    }, [problemId]);

    useEffect(() => {
        fetchProblem();
        fetchSubmissions();
    }, [fetchProblem, fetchSubmissions]);

    const hasRunning = useMemo(
        () =>
            submissions.some((submission) =>
                ["PENDING", "RUNNING"].includes(submission.status)
            ),
        [submissions]
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

    return (
        <Box>
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 3,
                }}
            >
                <Typography variant="h4" fontWeight={700}>
                    {problem ? `${problem.title} 제출 기록` : "제출 기록"}
                </Typography>
                {problem && (
                    <Button
                        component={Link}
                        to={`/problems/${problem.id}`}
                        variant="outlined"
                    >
                        문제로 돌아가기
                    </Button>
                )}
            </Box>

            {error && (
                <Typography color="error" mb={2}>
                    {error}
                </Typography>
            )}

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
                                <TableCell>언어</TableCell>
                                <TableCell>상태</TableCell>
                                <TableCell>시간</TableCell>
                                <TableCell>메모리</TableCell>
                                <TableCell>제출 시각</TableCell>
                                <TableCell>수정</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {submissions.map((submission) => (
                                <TableRow key={submission.id} hover>
                                    <TableCell>
                                        <Link
                                            to={`/submissions/${submission.id}`}
                                        >
                                            {submission.id}
                                        </Link>
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
                                        {formatDuration(submission.runtimeMs)}
                                    </TableCell>
                                    <TableCell>
                                        {formatMemory(submission.memoryKb)}
                                    </TableCell>
                                    <TableCell>
                                        {formatDateTime(submission.createdAt)}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            component={Link}
                                            to={`/problems/${problemId}?submissionId=${submission.id}`}
                                            size="small"
                                            variant="outlined"
                                        >
                                            수정
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {submissions.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7}>
                                        <Typography color="text.secondary">
                                            아직 제출 기록이 없습니다.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </Box>
    );
}
