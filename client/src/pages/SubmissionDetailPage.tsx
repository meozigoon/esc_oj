import { Button, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    apiFetch,
    Submission,
    formatDateTime,
    formatDuration,
    formatMemory,
} from "../api";
import PageHeader from "../components/PageHeader";
import StatusChip from "../components/StatusChip";

function isAccessError(err: unknown): boolean {
    if (!(err instanceof Error)) {
        return false;
    }
    const status = (err as Error & { status?: number }).status;
    return status === 401 || status === 403 || status === 404;
}

export default function SubmissionDetailPage() {
    const { id } = useParams();
    const submissionId = Number(id);
    const isValidSubmissionId =
        Number.isFinite(submissionId) && submissionId > 0;
    const [submission, setSubmission] = useState<Submission | null>(null);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const isAccepted = submission?.status === "ACCEPTED";
    const requestIdRef = useRef(0);

    const fetchSubmission = useCallback(
        async (reset = false) => {
            const requestId = requestIdRef.current + 1;
            requestIdRef.current = requestId;

            if (!isValidSubmissionId) {
                setSubmission(null);
                setError("잘못된 submissionId입니다.");
                return;
            }
            setError(null);
            if (reset) {
                setSubmission(null);
            }
            try {
                const data = await apiFetch<{ submission: Submission }>(
                    `/api/submissions/${submissionId}`,
                );
                if (requestIdRef.current !== requestId) {
                    return;
                }
                setSubmission(data.submission);
            } catch (err) {
                if (requestIdRef.current !== requestId) {
                    return;
                }
                if (isAccessError(err)) {
                    setSubmission(null);
                    setError(null);
                    navigate("/submissions", { replace: true });
                    return;
                }
                setSubmission(null);
                setError(
                    err instanceof Error
                        ? err.message
                        : "제출을 불러오지 못했습니다.",
                );
            }
        },
        [submissionId, isValidSubmissionId, navigate],
    );

    useEffect(() => {
        fetchSubmission(true);
    }, [fetchSubmission]);

    const shouldPoll =
        submission !== null &&
        ["PENDING", "RUNNING"].includes(submission.status);

    useEffect(() => {
        if (!shouldPoll) {
            return;
        }
        const timer = setInterval(() => {
            fetchSubmission();
        }, 1000);
        return () => clearInterval(timer);
    }, [fetchSubmission, shouldPoll]);

    const handleEdit = () => {
        if (!submission?.problem?.id) {
            return;
        }
        navigate(
            `/problems/${submission.problem.id}?submissionId=${submission.id}`,
        );
    };

    if (!submission) {
        return <Typography>{error ?? "Loading..."}</Typography>;
    }

    return (
        <Stack spacing={3}>
            <PageHeader
                title={`제출 #${submission.id}`}
                subtitle={`문제: ${submission.problem?.title ?? "-"}`}
                actions={
                    <Button
                        variant="outlined"
                        onClick={handleEdit}
                        disabled={!submission.problem?.id}
                    >
                        수정
                    </Button>
                }
            />
            <Stack direction="row" spacing={2} alignItems="center">
                <StatusChip
                    status={submission.status}
                    message={submission.message}
                />
                <Typography variant="body2" color="text.secondary">
                    제출 시각: {formatDateTime(submission.createdAt)}
                </Typography>
                {isAccepted && (
                    <Typography variant="body2" color="text.secondary">
                        실행 시간: {formatDuration(submission.runtimeMs)}
                    </Typography>
                )}
                {isAccepted && (
                    <Typography variant="body2" color="text.secondary">
                        메모리: {formatMemory(submission.memoryKb)}
                    </Typography>
                )}
            </Stack>
            {submission.failedTestcaseOrd && (
                <Typography variant="body2" color="error">
                    실패 테스트케이스: #{submission.failedTestcaseOrd}
                </Typography>
            )}
            {submission.detail && (
                <Typography variant="body2" color="text.secondary">
                    상세 로그: {submission.detail}
                </Typography>
            )}
        </Stack>
    );
}
