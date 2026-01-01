import {
    Button,
    Card,
    CardContent,
    List,
    ListItem,
    ListItemText,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch, Contest, ProblemSummary } from "../../api";
import { useAuth } from "../../auth";
import DifficultyBadge from "../../components/DifficultyBadge";

function toLocalInput(value: string) {
    const date = new Date(value);
    const offset = date.getTimezoneOffset();
    const adjusted = new Date(date.getTime() - offset * 60000);
    return adjusted.toISOString().slice(0, 16);
}

export default function AdminContestDetailPage() {
    const { id } = useParams();
    const contestId = Number(id);
    const isValidContestId = Number.isFinite(contestId) && contestId > 0;
    const { user } = useAuth();
    const isReadOnly = user?.role === "viewer";
    const [contest, setContest] = useState<Contest | null>(null);
    const [problems, setProblems] = useState<ProblemSummary[]>([]);
    const [title, setTitle] = useState("");
    const [startAt, setStartAt] = useState("");
    const [endAt, setEndAt] = useState("");
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!isValidContestId) {
            setContest(null);
            setProblems([]);
            setError("잘못된 contestId입니다.");
            return;
        }
        setError(null);
        apiFetch<{ contest: Contest }>(`/api/contests/${contestId}`)
            .then((data) => {
                setContest(data.contest);
                setTitle(data.contest.title);
                setStartAt(toLocalInput(data.contest.startAt));
                setEndAt(toLocalInput(data.contest.endAt));
            })
            .catch((err) =>
                setError(
                    err instanceof Error
                        ? err.message
                        : "대회를 불러오지 못했습니다."
                )
            );

        apiFetch<{ problems: ProblemSummary[] }>(
            `/api/contests/${contestId}/problems`
        )
            .then((data) => setProblems(data.problems))
            .catch(() => undefined);
    }, [contestId, isValidContestId]);

    const handleSave = async () => {
        if (!contestId) {
            return;
        }
        setError(null);
        try {
            await apiFetch(`/api/admin/contests/${contestId}`, {
                method: "PUT",
                body: JSON.stringify({ title, startAt, endAt }),
            });
            navigate("/admin/contests");
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "대회 수정에 실패했습니다."
            );
        }
    };

    if (!contest) {
        return <Typography>{error ?? "Loading..."}</Typography>;
    }

    return (
        <Stack spacing={3}>
            <Card
                sx={{
                    borderRadius: 2,
                    boxShadow: "0 16px 40px rgba(16,24,40,0.08)",
                }}
            >
                <CardContent>
                    <Stack spacing={2}>
                        <Typography variant="h5" fontWeight={700}>
                            대회 편집
                        </Typography>
                        <TextField
                            label="제목"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={isReadOnly}
                        />
                        <TextField
                            label="시작"
                            type="datetime-local"
                            value={startAt}
                            onChange={(e) => setStartAt(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            disabled={isReadOnly}
                        />
                        <TextField
                            label="종료"
                            type="datetime-local"
                            value={endAt}
                            onChange={(e) => setEndAt(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            disabled={isReadOnly}
                        />
                        {error && (
                            <Typography color="error">{error}</Typography>
                        )}
                        <Button
                            variant="contained"
                            onClick={handleSave}
                            disabled={isReadOnly}
                        >
                            저장
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

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
                                대회 문제
                            </Typography>
                            <Button
                                component={Link}
                                to={`/admin/problems?contestId=${contest.id}`}
                                variant="outlined"
                                disabled={isReadOnly}
                            >
                                문제 추가
                            </Button>
                        </Stack>
                        <List disablePadding>
                            {problems.map((problem, index) => (
                                <ListItem
                                    key={problem.id}
                                    divider={index < problems.length - 1}
                                    secondaryAction={
                                        <Button
                                            component={Link}
                                            to={`/admin/problems/${problem.id}`}
                                            size="small"
                                        >
                                            {isReadOnly ? "보기" : "편집"}
                                        </Button>
                                    }
                                >
                                    <ListItemText
                                        primary={problem.title}
                                        secondary={
                                            <Stack
                                                direction="row"
                                                spacing={1}
                                                alignItems="center"
                                            >
                                                <DifficultyBadge
                                                    difficulty={
                                                        problem.difficulty
                                                    }
                                                />
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    시간{" "}
                                                    {problem.timeLimitMs ?? "-"}{" "}
                                                    ms | 메모리{" "}
                                                    {problem.memoryLimitMb ??
                                                        "-"}{" "}
                                                    MB
                                                </Typography>
                                            </Stack>
                                        }
                                        secondaryTypographyProps={{
                                            component: "div",
                                        }}
                                    />
                                </ListItem>
                            ))}
                            {problems.length === 0 && (
                                <ListItem>
                                    <ListItemText primary="등록된 문제가 없습니다." />
                                </ListItem>
                            )}
                        </List>
                    </Stack>
                </CardContent>
            </Card>
        </Stack>
    );
}
