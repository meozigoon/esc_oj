import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch, Contest, Language, Problem, SubmissionType } from '../../api';
import { useAuth } from '../../auth';

const languageOptions: Array<{ value: Language; label: string }> = [
  { value: 'C99', label: 'C99' },
  { value: 'CPP17', label: 'C++17' },
  { value: 'JAVA11', label: 'Java 11' },
  { value: 'PYTHON3', label: 'Python 3' },
  { value: 'CS', label: 'C#' }
];

const submissionTypeOptions: Array<{ value: SubmissionType; label: string }> = [
  { value: 'CODE', label: '코드 제출' },
  { value: 'TEXT', label: '텍스트 제출' }
];

type JudgeMode = 'MANUAL' | 'GENERATED';

const judgeModeOptions: Array<{ value: JudgeMode; label: string }> = [
  { value: 'MANUAL', label: '테스트케이스 입력' },
  { value: 'GENERATED', label: '생성 코드' }
];

export default function AdminProblemsPage() {
  const { user } = useAuth();
  const isReadOnly = user?.role === 'viewer';
  const [problems, setProblems] = useState<Problem[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [title, setTitle] = useState('');
  const [statementMd, setStatementMd] = useState('');
  const [sampleInput, setSampleInput] = useState('');
  const [sampleOutput, setSampleOutput] = useState('');
  const [timeLimitMs, setTimeLimitMs] = useState(1000);
  const [memoryLimitMb, setMemoryLimitMb] = useState(256);
  const [contestId, setContestId] = useState<number | ''>('');
  const [submissionType, setSubmissionType] = useState<SubmissionType>('CODE');
  const [judgeMode, setJudgeMode] = useState<JudgeMode>('MANUAL');
  const [textAnswer, setTextAnswer] = useState('');
  const [generatorLanguage, setGeneratorLanguage] = useState<Language | ''>('');
  const [generatorCode, setGeneratorCode] = useState('');
  const [solutionLanguage, setSolutionLanguage] = useState<Language | ''>('');
  const [solutionCode, setSolutionCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const fetchAll = useCallback(() => {
    apiFetch<{ problems: Problem[] }>('/api/admin/problems')
      .then((data) => setProblems(data.problems))
      .catch((err) => setError(err instanceof Error ? err.message : '문제를 불러오지 못했습니다.'));
    apiFetch<{ contests: Contest[] }>('/api/contests')
      .then((data) => setContests(data.contests))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const contestParam = searchParams.get('contestId');
    if (!contestParam || contestId !== '') {
      return;
    }
    const parsed = Number(contestParam);
    if (Number.isFinite(parsed)) {
      setContestId(parsed);
    }
  }, [searchParams, contestId]);

  const handleCreate = async () => {
    setError(null);
    const useGeneratedTests = submissionType === 'CODE' && judgeMode === 'GENERATED';
    if (useGeneratedTests) {
      if (
        generatorLanguage === '' ||
        solutionLanguage === '' ||
        generatorCode.trim().length === 0 ||
        solutionCode.trim().length === 0
      ) {
        setError('생성 코드 채점을 선택한 경우 생성/정답 언어와 코드를 입력해 주세요.');
        return;
      }
    }
    try {
      await apiFetch('/api/admin/problems', {
        method: 'POST',
        body: JSON.stringify({
          title,
          statementMd,
          sampleInput,
          sampleOutput,
          timeLimitMs,
          memoryLimitMb,
          contestId: contestId === '' ? null : contestId,
          submissionType,
          textAnswer: submissionType === 'TEXT' ? textAnswer : '',
          generatorLanguage: useGeneratedTests && generatorLanguage !== '' ? generatorLanguage : null,
          generatorCode: useGeneratedTests ? generatorCode : '',
          solutionLanguage: useGeneratedTests && solutionLanguage !== '' ? solutionLanguage : null,
          solutionCode: useGeneratedTests ? solutionCode : ''
        })
      });
      setTitle('');
      setStatementMd('');
      setSampleInput('');
      setSampleOutput('');
      setSubmissionType('CODE');
      setJudgeMode('MANUAL');
      setTextAnswer('');
      setGeneratorLanguage('');
      setGeneratorCode('');
      setSolutionLanguage('');
      setSolutionCode('');
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제 생성에 실패했습니다.');
    }
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h4" fontWeight={700}>
        Problems
      </Typography>
      {error && <Typography color="error">{error}</Typography>}
      <Card sx={{ borderRadius: 2, boxShadow: '0 16px 40px rgba(16,24,40,0.08)' }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={700}>
              새 문제 생성
            </Typography>
            <TextField
              label="제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isReadOnly}
            />
            <TextField
              label="본문 (MDX)"
              value={statementMd}
              onChange={(e) => setStatementMd(e.target.value)}
              multiline
              minRows={4}
              disabled={isReadOnly}
            />
            <TextField
              label="예제 입력"
              value={sampleInput}
              onChange={(e) => setSampleInput(e.target.value)}
              multiline
              minRows={2}
              disabled={isReadOnly}
            />
            <TextField
              label="예제 출력"
              value={sampleOutput}
              onChange={(e) => setSampleOutput(e.target.value)}
              multiline
              minRows={2}
              disabled={isReadOnly}
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="시간 제한 (ms)"
                type="number"
                value={timeLimitMs}
                onChange={(e) => setTimeLimitMs(Number(e.target.value))}
                disabled={isReadOnly}
              />
              <TextField
                label="메모리 제한 (MB)"
                type="number"
                value={memoryLimitMb}
                onChange={(e) => setMemoryLimitMb(Number(e.target.value))}
                disabled={isReadOnly}
              />
            </Stack>
            <FormControl>
              <InputLabel id="submission-type-label">제출 유형</InputLabel>
              <Select
                labelId="submission-type-label"
                label="제출 유형"
                value={submissionType}
                onChange={(e) => {
                  const next = e.target.value as SubmissionType;
                  setSubmissionType(next);
                  if (next === 'TEXT') {
                    setJudgeMode('MANUAL');
                  }
                }}
                disabled={isReadOnly}
              >
                {submissionTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {submissionType === 'CODE' && (
              <FormControl>
                <InputLabel id="judge-mode-label">채점 방식</InputLabel>
                <Select
                  labelId="judge-mode-label"
                  label="채점 방식"
                  value={judgeMode}
                  onChange={(e) => setJudgeMode(e.target.value as JudgeMode)}
                  disabled={isReadOnly}
                >
                  {judgeModeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <FormControl>
              <InputLabel id="contest-label">대회</InputLabel>
              <Select
                labelId="contest-label"
                value={contestId}
                label="대회"
                onChange={(e) => setContestId(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={isReadOnly}
              >
                <MenuItem value="">없음</MenuItem>
                {contests.map((contest) => (
                  <MenuItem key={contest.id} value={contest.id}>
                    {contest.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {submissionType === 'TEXT' ? (
              <>
                <Typography variant="subtitle1" fontWeight={600}>
                  정답 텍스트
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  채점 시 공백과 개행을 무시하고 비교합니다.
                </Typography>
                <TextField
                  label="정답 텍스트"
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  multiline
                  minRows={4}
                  disabled={isReadOnly}
                />
              </>
            ) : (
              <>
                {judgeMode === 'GENERATED' ? (
                  <>
                    <Typography variant="subtitle1" fontWeight={600}>
                      테스트케이스 생성 코드
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      생성 코드는 JSON 배열(각 요소는 입력 문자열) 또는 --- 구분자로 테스트케이스를 출력하세요.
                    </Typography>
                    <FormControl>
                      <InputLabel id="generator-language-label">생성 언어</InputLabel>
                      <Select
                        labelId="generator-language-label"
                        label="생성 언어"
                        value={generatorLanguage}
                        onChange={(e) =>
                          setGeneratorLanguage(e.target.value === '' ? '' : (e.target.value as Language))
                        }
                        disabled={isReadOnly}
                      >
                        <MenuItem value="">없음</MenuItem>
                        {languageOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label="테스트케이스 생성 코드"
                      value={generatorCode}
                      onChange={(e) => setGeneratorCode(e.target.value)}
                      multiline
                      minRows={4}
                      disabled={isReadOnly}
                    />
                    <Typography variant="subtitle1" fontWeight={600}>
                      정답 코드
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      생성 코드와 정답 코드가 모두 입력된 경우 생성된 테스트케이스로 채점합니다.
                    </Typography>
                    <FormControl>
                      <InputLabel id="solution-language-label">정답 언어</InputLabel>
                      <Select
                        labelId="solution-language-label"
                        label="정답 언어"
                        value={solutionLanguage}
                        onChange={(e) =>
                          setSolutionLanguage(e.target.value === '' ? '' : (e.target.value as Language))
                        }
                        disabled={isReadOnly}
                      >
                        <MenuItem value="">없음</MenuItem>
                        {languageOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label="정답 코드"
                      value={solutionCode}
                      onChange={(e) => setSolutionCode(e.target.value)}
                      multiline
                      minRows={4}
                      disabled={isReadOnly}
                    />
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    테스트케이스로 채점합니다. 생성 후 문제 편집 화면에서 테스트케이스를 추가하세요.
                  </Typography>
                )}
              </>
            )}
            <Button variant="contained" onClick={handleCreate} disabled={isReadOnly}>
              생성
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={2}>
        {problems.map((problem) => (
          <Card key={problem.id} sx={{ borderRadius: 2, boxShadow: '0 12px 32px rgba(16,24,40,0.08)' }}>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="h6" fontWeight={700}>
                  {problem.title}
                </Typography>
                <Typography color="text.secondary">
                  시간 {problem.timeLimitMs} ms | 메모리 {problem.memoryLimitMb} MB
                </Typography>
                <Box>
                  <Button component={Link} to={`/admin/problems/${problem.id}`} variant="outlined">
                    {isReadOnly ? '보기' : '편집'}
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
