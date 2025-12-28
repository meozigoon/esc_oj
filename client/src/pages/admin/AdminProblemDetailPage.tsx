import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch, Contest, Language, Problem, Testcase } from '../../api';

const languageOptions: Array<{ value: Language; label: string }> = [
  { value: 'C99', label: 'C99' },
  { value: 'CPP17', label: 'C++17' },
  { value: 'JAVA11', label: 'Java 11' },
  { value: 'PYTHON3', label: 'Python 3' },
  { value: 'CS', label: 'C#' }
];

export default function AdminProblemDetailPage() {
  const { id } = useParams();
  const problemId = Number(id);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [contests, setContests] = useState<Contest[]>([]);
  const [testcases, setTestcases] = useState<Testcase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newInput, setNewInput] = useState('');
  const [newOutput, setNewOutput] = useState('');
  const [newOrd, setNewOrd] = useState<number | ''>('');
  const navigate = useNavigate();

  const fetchAll = useCallback(() => {
    if (!problemId) {
      return;
    }
    apiFetch<{ problem: Problem }>(`/api/admin/problems/${problemId}`)
      .then((data) => setProblem(data.problem))
      .catch((err) => setError(err instanceof Error ? err.message : '문제를 불러오지 못했습니다.'));
    apiFetch<{ testcases: Testcase[] }>(`/api/admin/problems/${problemId}/testcases`)
      .then((data) => setTestcases(data.testcases))
      .catch((err) => setError(err instanceof Error ? err.message : '테스트케이스를 불러오지 못했습니다.'));
    apiFetch<{ contests: Contest[] }>('/api/contests')
      .then((data) => setContests(data.contests))
      .catch(() => undefined);
  }, [problemId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSaveProblem = async () => {
    if (!problem) {
      return;
    }
    try {
      await apiFetch(`/api/admin/problems/${problem.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: problem.title,
          statementMd: problem.statementMd,
          sampleInput: problem.sampleInput,
          sampleOutput: problem.sampleOutput,
          timeLimitMs: problem.timeLimitMs,
          memoryLimitMb: problem.memoryLimitMb,
          contestId: problem.contestId ?? null,
          generatorLanguage: problem.generatorLanguage ?? null,
          generatorCode: problem.generatorCode ?? '',
          solutionLanguage: problem.solutionLanguage ?? null,
          solutionCode: problem.solutionCode ?? ''
        })
      });
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제 수정에 실패했습니다.');
    }
  };

  const handleDeleteProblem = async () => {
    if (!problem) {
      return;
    }
    if (!confirm('문제를 삭제할까요?')) {
      return;
    }
    try {
      await apiFetch(`/api/admin/problems/${problem.id}`, { method: 'DELETE' });
      navigate('/admin/problems');
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제 삭제에 실패했습니다.');
    }
  };

  const handleCreateTestcase = async () => {
    if (!problemId) {
      return;
    }
    try {
      await apiFetch(`/api/admin/problems/${problemId}/testcases`, {
        method: 'POST',
        body: JSON.stringify({
          input: newInput,
          output: newOutput,
          ord: newOrd === '' ? undefined : newOrd
        })
      });
      setNewInput('');
      setNewOutput('');
      setNewOrd('');
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : '테스트케이스 추가에 실패했습니다.');
    }
  };

  const handleUpdateTestcase = async (testcase: Testcase) => {
    try {
      await apiFetch(`/api/admin/problems/${problemId}/testcases/${testcase.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          input: testcase.input,
          output: testcase.output,
          ord: testcase.ord
        })
      });
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : '테스트케이스 수정에 실패했습니다.');
    }
  };

  const handleDeleteTestcase = async (testcaseId: number) => {
    if (!confirm('테스트케이스를 삭제할까요?')) {
      return;
    }
    try {
      await apiFetch(`/api/admin/problems/${problemId}/testcases/${testcaseId}`, { method: 'DELETE' });
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : '테스트케이스 삭제에 실패했습니다.');
    }
  };

  if (!problem) {
    return <Typography>{error ?? 'Loading...'}</Typography>;
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4" fontWeight={700}>
        문제 편집
      </Typography>
      {error && <Typography color="error">{error}</Typography>}

      <Card sx={{ borderRadius: 2, boxShadow: '0 16px 40px rgba(16,24,40,0.08)' }}>
        <CardContent>
          <Stack spacing={2}>
            <TextField
              label="제목"
              value={problem.title}
              onChange={(e) => setProblem({ ...problem, title: e.target.value })}
            />
            <TextField
              label="본문 (MDX)"
              value={problem.statementMd}
              onChange={(e) => setProblem({ ...problem, statementMd: e.target.value })}
              multiline
              minRows={4}
            />
            <TextField
              label="예제 입력"
              value={problem.sampleInput}
              onChange={(e) => setProblem({ ...problem, sampleInput: e.target.value })}
              multiline
              minRows={2}
            />
            <TextField
              label="예제 출력"
              value={problem.sampleOutput}
              onChange={(e) => setProblem({ ...problem, sampleOutput: e.target.value })}
              multiline
              minRows={2}
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="시간 제한 (ms)"
                type="number"
                value={problem.timeLimitMs}
                onChange={(e) =>
                  setProblem({ ...problem, timeLimitMs: Number(e.target.value) })
                }
              />
              <TextField
                label="메모리 제한 (MB)"
                type="number"
                value={problem.memoryLimitMb}
                onChange={(e) =>
                  setProblem({ ...problem, memoryLimitMb: Number(e.target.value) })
                }
              />
            </Stack>
            <FormControl>
              <InputLabel id="contest-label">대회</InputLabel>
              <Select
                labelId="contest-label"
                label="대회"
                value={problem.contestId ?? ''}
                onChange={(e) =>
                  setProblem({
                    ...problem,
                    contestId: e.target.value === '' ? null : Number(e.target.value)
                  })
                }
              >
                <MenuItem value="">없음</MenuItem>
                {contests.map((contest) => (
                  <MenuItem key={contest.id} value={contest.id}>
                    {contest.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="subtitle1" fontWeight={600}>
              테스트케이스 생성 코드 (선택)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              생성 코드는 JSON 배열(각 요소는 입력 문자열) 또는 --- 구분자로 테스트케이스를 출력하세요.
            </Typography>
            <FormControl>
              <InputLabel id="generator-language-label">생성 언어</InputLabel>
              <Select
                labelId="generator-language-label"
                label="생성 언어"
                value={problem.generatorLanguage ?? ''}
                onChange={(e) =>
                  setProblem({
                    ...problem,
                    generatorLanguage: e.target.value === '' ? null : (e.target.value as Language)
                  })
                }
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
              value={problem.generatorCode ?? ''}
              onChange={(e) =>
                setProblem({ ...problem, generatorCode: e.target.value })
              }
              multiline
              minRows={4}
            />
            <Typography variant="subtitle1" fontWeight={600}>
              정답 코드 (선택)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              생성 코드와 정답 코드가 모두 입력된 경우 생성된 테스트케이스로 채점합니다.
            </Typography>
            <FormControl>
              <InputLabel id="solution-language-label">정답 언어</InputLabel>
              <Select
                labelId="solution-language-label"
                label="정답 언어"
                value={problem.solutionLanguage ?? ''}
                onChange={(e) =>
                  setProblem({
                    ...problem,
                    solutionLanguage: e.target.value === '' ? null : (e.target.value as Language)
                  })
                }
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
              value={problem.solutionCode ?? ''}
              onChange={(e) =>
                setProblem({ ...problem, solutionCode: e.target.value })
              }
              multiline
              minRows={4}
            />
            <Stack direction="row" spacing={2}>
              <Button variant="contained" onClick={handleSaveProblem}>
                저장
              </Button>
              <Button color="error" onClick={handleDeleteProblem}>
                삭제
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 2, boxShadow: '0 16px 40px rgba(16,24,40,0.08)' }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={700}>
              테스트케이스
            </Typography>
            {testcases.map((testcase) => (
              <Box key={testcase.id} sx={{ p: 2, borderRadius: 1, border: '1px solid #e5e7eb' }}>
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="순서"
                      type="number"
                      value={testcase.ord}
                      onChange={(e) =>
                        setTestcases((prev) =>
                          prev.map((item) =>
                            item.id === testcase.id ? { ...item, ord: Number(e.target.value) } : item
                          )
                        )
                      }
                    />
                    <Button variant="outlined" onClick={() => handleUpdateTestcase(testcase)}>
                      저장
                    </Button>
                    <Button color="error" onClick={() => handleDeleteTestcase(testcase.id)}>
                      삭제
                    </Button>
                  </Stack>
                  <TextField
                    label="입력"
                    multiline
                    minRows={2}
                    value={testcase.input}
                    onChange={(e) =>
                      setTestcases((prev) =>
                        prev.map((item) =>
                          item.id === testcase.id ? { ...item, input: e.target.value } : item
                        )
                      )
                    }
                  />
                  <TextField
                    label="출력"
                    multiline
                    minRows={2}
                    value={testcase.output}
                    onChange={(e) =>
                      setTestcases((prev) =>
                        prev.map((item) =>
                          item.id === testcase.id ? { ...item, output: e.target.value } : item
                        )
                      )
                    }
                  />
                </Stack>
              </Box>
            ))}
            <Divider />
            <Typography variant="subtitle1" fontWeight={600}>
              새 테스트케이스 추가
            </Typography>
            <TextField
              label="순서 (선택)"
              type="number"
              value={newOrd}
              onChange={(e) => setNewOrd(e.target.value === '' ? '' : Number(e.target.value))}
            />
            <TextField
              label="입력"
              multiline
              minRows={2}
              value={newInput}
              onChange={(e) => setNewInput(e.target.value)}
            />
            <TextField
              label="출력"
              multiline
              minRows={2}
              value={newOutput}
              onChange={(e) => setNewOutput(e.target.value)}
            />
            <Button variant="contained" onClick={handleCreateTestcase}>
              추가
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
