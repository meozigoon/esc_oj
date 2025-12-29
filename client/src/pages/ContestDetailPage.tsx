import {
    Box,
    Button,
    Card,
    CardContent,
    List,
    ListItem,
    ListItemText,
    Stack,
    Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, Contest, formatDateTime, ProblemSummary } from "../api";
import Countdown from "../components/Countdown";
import DifficultyBadge from "../components/DifficultyBadge";

export default function ContestDetailPage() {
    const { id } = useParams();
    const contestId = Number(id);
    const [contest, setContest] = useState<Contest | null>(null);
    const [problems, setProblems] = useState<ProblemSummary[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!contestId) {
            return;
        }
        setError(null);
        apiFetch<{ contest: Contest }>(`/api/contests/${contestId}`)
            .then((data) => setContest(data.contest))
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
            .catch((err) =>
                setError(
                    err instanceof Error
                        ? err.message
                        : "문제를 불러오지 못했습니다."
                )
            );
    }, [contestId]);

    const canSubmit = useMemo(() => {
        if (!contest) {
            return false;
        }
        const now = Date.now();
        const start = new Date(contest.startAt).getTime();
        const end = new Date(contest.endAt).getTime();
        return now >= start && now <= end;
    }, [contest]);

    if (!contest) {
        return (
            <Box>
                {error ? (
                    <Typography color="error">{error}</Typography>
                ) : (
                    <Typography>Loading...</Typography>
                )}
            </Box>
        );
    }

    return (
        <Box>
            <Stack spacing={2} mb={4}>
                <Typography variant="h4" fontWeight={700}>
                    {contest.title}
                </Typography>
                <Typography color="text.secondary">
                    {formatDateTime(contest.startAt)} -{" "}
                    {formatDateTime(contest.endAt)}
                </Typography>
                <Countdown startAt={contest.startAt} endAt={contest.endAt} />
                {!canSubmit && (
                    <Typography color="error" variant="body2">
                        현재는 제출할 수 없습니다.
                    </Typography>
                )}
            </Stack>
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
                    <List disablePadding>
                        {problems.map((problem, index) => (
                            <ListItem
                                key={problem.id}
                                divider={index < problems.length - 1}
                                secondaryAction={
                                    <Button
                                        component={Link}
                                        to={`/problems/${problem.id}`}
                                        variant="outlined"
                                    >
                                        문제 보기
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
                                                difficulty={problem.difficulty}
                                            />
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                시간 제한{" "}
                                                {problem.timeLimitMs ?? "-"} ms
                                                | 메모리 제한{" "}
                                                {problem.memoryLimitMb ?? "-"}{" "}
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
                </CardContent>
            </Card>
        </Box>
    );
}
