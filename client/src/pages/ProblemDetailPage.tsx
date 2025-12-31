import {
    Box,
    Button,
    Card,
    CardContent,
    Divider,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Link,
    useNavigate,
    useParams,
    useSearchParams,
} from "react-router-dom";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import {
    apiFetch,
    Language,
    Problem,
    Submission,
    SubmissionStatus,
} from "../api";
import { useAuth } from "../auth";
import DifficultyBadge from "../components/DifficultyBadge";

const languageOptions: Array<{
    value: Language;
    label: string;
    monaco: string;
}> = [
    { value: "C99", label: "C99", monaco: "c" },
    { value: "CPP17", label: "C++17", monaco: "cpp" },
    { value: "JAVA11", label: "Java 11", monaco: "java" },
    { value: "PYTHON3", label: "Python 3", monaco: "python" },
    { value: "CS", label: "C#", monaco: "csharp" },
];

const errorStatuses = new Set<SubmissionStatus>([
    "COMPILE_ERROR",
    "RUNTIME_ERROR",
    "TIME_LIMIT_EXCEEDED",
    "MEMORY_LIMIT_EXCEEDED",
    "PRESENTATION_ERROR",
    "SYSTEM_ERROR",
]);

const languageNotes: Record<Language, string[]> = {
    C99: ["컴파일러: GCC (C99)"],
    CPP17: ["컴파일러: G++ (C++17)"],
    JAVA11: ["컴파일러: Java 11 (javac)", "클래스 이름: Main"],
    PYTHON3: ["런타임: Python 3"],
    CS: ["컴파일러/런타임: Mono (mcs/mono)", "클래스 이름: MainClass"],
};

export default function ProblemDetailPage() {
    const { id } = useParams();
    const problemId = Number(id);
    const [problem, setProblem] = useState<Problem | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [language, setLanguage] = useState<Language>("CPP17");
    const [code, setCode] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [loadedSubmission, setLoadedSubmission] = useState<Submission | null>(
        null
    );
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const lastLoadedSubmissionId = useRef<number | null>(null);
    const isTextProblem = problem?.submissionType === "TEXT";

    useEffect(() => {
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

    useEffect(() => {
        setCode("");
        setSubmitError(null);
    }, [problemId]);

    useEffect(() => {
        const submissionId = Number(searchParams.get("submissionId"));
        if (!Number.isFinite(submissionId) || submissionId <= 0) {
            lastLoadedSubmissionId.current = null;
            setLoadedSubmission(null);
            return;
        }
        if (!user) {
            setSubmitError("로그인 후 제출 코드를 불러올 수 있습니다.");
            return;
        }
        if (lastLoadedSubmissionId.current === submissionId) {
            return;
        }
        setSubmitError(null);
        apiFetch<{ submission: Submission }>(`/api/submissions/${submissionId}`)
            .then((data) => {
                const submission = data.submission;
                if (submission.problem && submission.problem.id !== problemId) {
                    setSubmitError("다른 문제의 제출입니다.");
                    return;
                }
                if (!isTextProblem) {
                    setLanguage(submission.language);
                }
                setCode(submission.code ?? "");
                setLoadedSubmission(submission);
                lastLoadedSubmissionId.current = submissionId;
            })
            .catch((err) =>
                setSubmitError(
                    err instanceof Error
                        ? err.message
                        : "제출 코드를 불러오지 못했습니다."
                )
            );
    }, [problemId, searchParams, user, isTextProblem]);

    const canSubmit = useMemo(() => {
        if (!problem?.contest) {
            return true;
        }
        const now = Date.now();
        const start = new Date(problem.contest.startAt).getTime();
        const end = new Date(problem.contest.endAt).getTime();
        return now >= start && now <= end;
    }, [problem]);

    const handleSubmit = async () => {
        if (!problem) {
            return;
        }
        setSubmitting(true);
        setSubmitError(null);
        try {
            const payload: {
                problemId: number;
                contestId: number | null;
                language?: Language;
                code: string;
            } = {
                problemId: problem.id,
                contestId: problem.contestId,
                code,
            };
            if (!isTextProblem) {
                payload.language = language;
            }
            await apiFetch<{ submissionId: number }>("/api/submissions", {
                method: "POST",
                body: JSON.stringify(payload),
            });
            navigate(`/problems/${problem.id}/submissions`);
        } catch (err) {
            setSubmitError(
                err instanceof Error ? err.message : "제출에 실패했습니다."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const languageConfig =
        languageOptions.find((option) => option.value === language) ??
        languageOptions[1];

    if (!problem) {
        return <Typography>{error ?? "Loading..."}</Typography>;
    }

    const sampleInputValue = problem.sampleInput ?? "";
    const sampleOutputValue = problem.sampleOutput ?? "";
    const hasSampleInput = sampleInputValue.trim().length > 0;
    const hasSampleOutput = sampleOutputValue.trim().length > 0;
    const hasSamples = hasSampleInput || hasSampleOutput;

    return (
        <Stack spacing={3}>
            <Stack spacing={1}>
                <Typography variant="h4" fontWeight={700}>
                    {problem.title}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                    <DifficultyBadge difficulty={problem.difficulty} />
                    <Typography color="text.secondary">
                        시간 제한 {problem.timeLimitMs} ms | 메모리 제한{" "}
                        {problem.memoryLimitMb} MB
                    </Typography>
                </Stack>
            </Stack>

            {problem.contest && (
                <Typography color={canSubmit ? "text.secondary" : "error"}>
                    {canSubmit
                        ? "대회 시간 내 제출 가능"
                        : "대회 시간이 아닙니다."}
                </Typography>
            )}

            <Grid container spacing={3}>
                <Grid item xs={12} md={5}>
                    <Card
                        sx={{
                            borderRadius: 2,
                            boxShadow: "0 16px 40px rgba(16,24,40,0.08)",
                        }}
                    >
                        <CardContent>
                            <Stack spacing={2}>
                                <Typography variant="h6" fontWeight={700}>
                                    문제 설명
                                </Typography>
                                <ReactMarkdown>
                                    {problem.statementMd}
                                </ReactMarkdown>
                                {hasSamples ? (
                                    <>
                                        <Divider />
                                        {hasSampleInput && (
                                            <>
                                                <Typography
                                                    variant="subtitle1"
                                                    fontWeight={600}
                                                >
                                                    예제 입력
                                                </Typography>
                                                <Box
                                                    component="pre"
                                                    sx={{
                                                        p: 2,
                                                        backgroundColor:
                                                            "rgba(31, 122, 140, 0.08)",
                                                        borderRadius: 1,
                                                        fontFamily: "monospace",
                                                    }}
                                                >
                                                    {sampleInputValue}
                                                </Box>
                                            </>
                                        )}
                                        {hasSampleOutput && (
                                            <>
                                                <Typography
                                                    variant="subtitle1"
                                                    fontWeight={600}
                                                >
                                                    예제 출력
                                                </Typography>
                                                <Box
                                                    component="pre"
                                                    sx={{
                                                        p: 2,
                                                        backgroundColor:
                                                            "rgba(244, 162, 97, 0.12)",
                                                        borderRadius: 1,
                                                        fontFamily: "monospace",
                                                    }}
                                                >
                                                    {sampleOutputValue}
                                                </Box>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Divider />
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            예제 입출력이 없습니다.
                                        </Typography>
                                    </>
                                )}
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={7}>
                    <Card
                        sx={{
                            borderRadius: 2,
                            boxShadow: "0 16px 40px rgba(16,24,40,0.08)",
                        }}
                    >
                        <CardContent>
                            <Stack spacing={2}>
                                <Stack
                                    direction="row"
                                    justifyContent="space-between"
                                    alignItems="center"
                                >
                                    <Typography variant="h6" fontWeight={700}>
                                        제출
                                    </Typography>
                                    <Button
                                        component={Link}
                                        to={`/problems/${problem.id}/submissions`}
                                        size="small"
                                    >
                                        제출 기록
                                    </Button>
                                </Stack>
                                {!isTextProblem && (
                                    <>
                                        <FormControl fullWidth>
                                            <InputLabel id="language-label">
                                                언어
                                            </InputLabel>
                                            <Select
                                                labelId="language-label"
                                                value={language}
                                                label="언어"
                                                onChange={(e) =>
                                                    setLanguage(
                                                        e.target
                                                            .value as Language
                                                    )
                                                }
                                            >
                                                {languageOptions.map(
                                                    (option) => (
                                                        <MenuItem
                                                            key={option.value}
                                                            value={option.value}
                                                        >
                                                            {option.label}
                                                        </MenuItem>
                                                    )
                                                )}
                                            </Select>
                                        </FormControl>
                                        <Box
                                            sx={{
                                                borderRadius: 1,
                                                border: "1px solid rgba(15, 23, 42, 0.08)",
                                                backgroundColor:
                                                    "rgba(148, 163, 184, 0.12)",
                                                px: 2,
                                                py: 1.5,
                                            }}
                                        >
                                            <Typography
                                                variant="subtitle2"
                                                fontWeight={600}
                                                gutterBottom
                                            >
                                                채점 환경 안내
                                            </Typography>
                                            <Stack spacing={0.5}>
                                                {languageNotes[language].map(
                                                    (note, index) => (
                                                        <Typography
                                                            key={`${language}-${index}`}
                                                            variant="body2"
                                                            color="text.secondary"
                                                        >
                                                            {note}
                                                        </Typography>
                                                    )
                                                )}
                                            </Stack>
                                        </Box>
                                    </>
                                )}
                                {isTextProblem && (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        텍스트 제출 문제입니다. 공백과 개행을
                                        무시하고 채점합니다.
                                    </Typography>
                                )}
                                {loadedSubmission &&
                                    errorStatuses.has(
                                        loadedSubmission.status
                                    ) && (
                                        <Stack spacing={0.5}>
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                이전 제출 상태:{" "}
                                                {loadedSubmission.message}
                                            </Typography>
                                            {loadedSubmission.detail && (
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{
                                                        whiteSpace: "pre-wrap",
                                                    }}
                                                >
                                                    에러 사유:{" "}
                                                    {loadedSubmission.detail}
                                                </Typography>
                                            )}
                                        </Stack>
                                    )}
                                {isTextProblem ? (
                                    <TextField
                                        label="제출 텍스트"
                                        value={code}
                                        onChange={(e) =>
                                            setCode(e.target.value)
                                        }
                                        multiline
                                        minRows={10}
                                    />
                                ) : (
                                    <Box
                                        sx={{
                                            borderRadius: 1,
                                            overflow: "hidden",
                                            border: "1px solid #e5e7eb",
                                        }}
                                    >
                                        <Editor
                                            height="420px"
                                            language={languageConfig.monaco}
                                            value={code}
                                            onChange={(value) =>
                                                setCode(value ?? "")
                                            }
                                            theme="vs"
                                            options={{
                                                fontSize: 14,
                                                minimap: { enabled: false },
                                                scrollBeyondLastLine: false,
                                            }}
                                        />
                                    </Box>
                                )}
                                {submitError && (
                                    <Typography color="error">
                                        {submitError}
                                    </Typography>
                                )}
                                {!user && (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        제출하려면 로그인해야 합니다.
                                    </Typography>
                                )}
                                <Button
                                    variant="contained"
                                    onClick={handleSubmit}
                                    disabled={!user || !canSubmit || submitting}
                                >
                                    제출하기
                                </Button>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Stack>
    );
}
