import {
    Button,
    Card,
    CardContent,
    Stack,
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
import PageHeader from "../components/PageHeader";
import StatusChip from "../components/StatusChip";

export default function ProblemSubmissionsPage() {
    const { id } = useParams();
    const problemId = Number(id);
    const isValidProblemId = Number.isFinite(problemId) && problemId > 0;
    const [problem, setProblem] = useState<Problem | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [error, setError] = useState<string | null>(null);

    const fetchProblem = useCallback(() => {
        if (!isValidProblemId) {
            return;
        }
        setError(null);
        apiFetch<{ problem: Problem }>(`/api/problems/${problemId}`)
            .then((data) => setProblem(data.problem))
            .catch((err) => {
                setProblem(null);
                setError(
                    err instanceof Error
                        ? err.message
                        : "문제를 불러오지 못했습니다.",
                );
            });
    }, [problemId, isValidProblemId]);

    const fetchSubmissions = useCallback(() => {
        if (!isValidProblemId) {
            return;
        }
        setError(null);
        apiFetch<{ submissions: Submission[] }>(
            `/api/submissions?problemId=${problemId}&limit=200`,
        )
            .then((data) => setSubmissions(data.submissions))
            .catch((err) => {
                setSubmissions([]);
                setError(
                    err instanceof Error
                        ? err.message
                        : "제출을 불러오지 못했습니다.",
                );
            });
    }, [problemId, isValidProblemId]);

    useEffect(() => {
        if (!isValidProblemId) {
            setProblem(null);
            setSubmissions([]);
            setError("잘못된 problemId입니다.");
            return;
        }
        setProblem(null);
        setSubmissions([]);
        fetchProblem();
        fetchSubmissions();
    }, [fetchProblem, fetchSubmissions, isValidProblemId]);

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

    return (
        <Stack spacing={3}>
            <PageHeader
                title={problem ? `${problem.title} 제출 기록` : "제출 기록"}
                actions={
                    problem ? (
                        <Button
                            component={Link}
                            to={`/problems/${problem.id}`}
                            variant="outlined"
                        >
                            문제로 돌아가기
                        </Button>
                    ) : null
                }
            />

            {error && (
                <Typography color="error" mb={2}>
                    {error}
                </Typography>
            )}

            <Card>
                <CardContent>
                    <Table>
                        <TableHead>
                            <TableRow>
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
                                    <TableCell colSpan={6}>
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
        </Stack>
    );
}
