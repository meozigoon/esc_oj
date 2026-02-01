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
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    apiFetch,
    Submission,
    formatDateTime,
    formatDuration,
    formatMemory,
} from "../api";
import PageHeader from "../components/PageHeader";
import StatusChip from "../components/StatusChip";

export default function SubmissionListPage() {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setError(null);
        apiFetch<{ submissions: Submission[] }>(
            "/api/submissions?mine=1&limit=200",
        )
            .then((data) => setSubmissions(data.submissions))
            .catch((err) =>
                setError(
                    err instanceof Error
                        ? err.message
                        : "제출을 불러오지 못했습니다.",
                ),
            );
    }, []);

    return (
        <Stack spacing={3}>
            <PageHeader title="내 제출" />
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
        </Stack>
    );
}
