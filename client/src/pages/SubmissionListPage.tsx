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
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    apiFetch,
    Submission,
    formatDateTime,
    formatDuration,
    formatMemory,
} from "../api";
import StatusChip from "../components/StatusChip";

export default function SubmissionListPage() {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiFetch<{ submissions: Submission[] }>("/api/submissions?mine=1")
            .then((data) => setSubmissions(data.submissions))
            .catch((err) =>
                setError(
                    err instanceof Error
                        ? err.message
                        : "제출을 불러오지 못했습니다."
                )
            );
    }, []);

    return (
        <Box>
            <Typography variant="h4" fontWeight={700} mb={3}>
                내 제출
            </Typography>
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
                                <TableCell>문제</TableCell>
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
                                            to={
                                                submission.problem?.id
                                                    ? `/problems/${submission.problem.id}?submissionId=${submission.id}`
                                                    : "/contests"
                                            }
                                            size="small"
                                            variant="outlined"
                                            disabled={!submission.problem?.id}
                                        >
                                            수정
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </Box>
    );
}
