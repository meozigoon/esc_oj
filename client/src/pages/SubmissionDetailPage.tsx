import { Button, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch, Submission, formatDateTime, formatDuration, formatMemory } from '../api';
import StatusChip from '../components/StatusChip';

export default function SubmissionDetailPage() {
  const { id } = useParams();
  const submissionId = Number(id);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchSubmission = useCallback(async () => {
    if (!submissionId) {
      return;
    }
    try {
      const data = await apiFetch<{ submission: Submission }>(`/api/submissions/${submissionId}`);
      setSubmission(data.submission);
    } catch (err) {
      setError(err instanceof Error ? err.message : '제출을 불러오지 못했습니다.');
    }
  }, [submissionId]);

  useEffect(() => {
    fetchSubmission();
  }, [fetchSubmission]);

  useEffect(() => {
    if (!submission || !['PENDING', 'RUNNING'].includes(submission.status)) {
      return;
    }
    const timer = setInterval(() => {
      fetchSubmission();
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchSubmission, submission?.status]);

  const handleEdit = () => {
    if (!submission?.problem?.id) {
      return;
    }
    navigate(`/problems/${submission.problem.id}?submissionId=${submission.id}`);
  };

  if (!submission) {
    return <Typography>{error ?? 'Loading...'}</Typography>;
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h4" fontWeight={700}>
          제출 #{submission.id}
        </Typography>
        <Typography color="text.secondary">문제: {submission.problem?.title ?? '-'}</Typography>
        <Button
          variant="outlined"
          onClick={handleEdit}
          disabled={!submission.problem?.id}
          sx={{ alignSelf: 'flex-start' }}
        >
          수정
        </Button>
        <Stack direction="row" spacing={2} alignItems="center">
          <StatusChip status={submission.status} message={submission.message} />
          <Typography variant="body2" color="text.secondary">
            제출 시각: {formatDateTime(submission.createdAt)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            실행 시간: {formatDuration(submission.runtimeMs)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            메모리: {formatMemory(submission.memoryKb)}
          </Typography>
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
    </Stack>
  );
}
