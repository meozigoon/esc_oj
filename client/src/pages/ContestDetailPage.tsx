import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    List,
    ListItem,
    ListItemText,
    Stack,
    Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    apiFetch,
    Contest,
    ProblemSummary,
    Submission,
    formatDateTime,
} from "../api";
import Countdown from "../components/Countdown";
import DifficultyBadge from "../components/DifficultyBadge";
import PageHeader from "../components/PageHeader";

export default function ContestDetailPage() {
    const { id } = useParams();
    const contestId = Number(id);
    const isValidContestId = Number.isFinite(contestId) && contestId > 0;
    const [contest, setContest] = useState<Contest | null>(null);
    const [problems, setProblems] = useState<ProblemSummary[]>([]);
    const [solvedProblems, setSolvedProblems] = useState<Set<number>>(
        new Set(),
    );
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (!isValidContestId) {
            setContest(null);
            setProblems([]);
            setError("잘못된 contestId입니다.");
            return;
        }
        setError(null);
        setContest(null);
        setProblems([]);
        setSolvedProblems(new Set());
        apiFetch<{ contest: Contest }>(`/api/contests/${contestId}`)
            .then((data) => setContest(data.contest))
            .catch((err) =>
                setError(
                    err instanceof Error
                        ? err.message
                        : "대회를 불러오지 못했습니다.",
                ),
            );

        apiFetch<{ problems: ProblemSummary[] }>(
            `/api/contests/${contestId}/problems`,
        )
            .then((data) => setProblems(data.problems))
            .catch((err) =>
                setError(
                    err instanceof Error
                        ? err.message
                        : "문제를 불러오지 못했습니다.",
                ),
            );
    }, [contestId, isValidContestId]);

    useEffect(() => {
        if (!contest) {
            return;
        }
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [contest]);

    useEffect(() => {
        if (!isValidContestId) {
            setSolvedProblems(new Set());
            return;
        }
        apiFetch<{ submissions: Submission[] }>(
            `/api/submissions?mine=1&status=ACCEPTED&contestId=${contestId}`,
        )
            .then((data) => {
                const next = new Set<number>();
                data.submissions.forEach((submission) => {
                    if (submission.problem?.id) {
                        next.add(submission.problem.id);
                    }
                });
                setSolvedProblems(next);
            })
            .catch(() => setSolvedProblems(new Set()));
    }, [contestId, isValidContestId]);

    const canSubmit = useMemo(() => {
        if (!contest) {
            return false;
        }
        const start = new Date(contest.startAt).getTime();
        const end = new Date(contest.endAt).getTime();
        return now >= start && now <= end;
    }, [contest, now]);

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
        <Stack spacing={3}>
            <PageHeader
                title={contest.title}
                subtitle={`${formatDateTime(contest.startAt)} - ${formatDateTime(contest.endAt)}`}
            />
            <Countdown startAt={contest.startAt} endAt={contest.endAt} />
            {!canSubmit && (
                <Typography color="error" variant="body2">
                    현재는 제출할 수 없습니다.
                </Typography>
            )}
            {error && (
                <Typography color="error" mb={2}>
                    {error}
                </Typography>
            )}
            <Card>
                <CardContent>
                    <List disablePadding>
                        {problems.map((problem, index) => {
                            const isSolved = solvedProblems.has(problem.id);
                            return (
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
                                                    difficulty={
                                                        problem.difficulty
                                                    }
                                                />
                                                {isSolved && (
                                                    <Chip
                                                        label="성공"
                                                        color="success"
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                )}
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    시간 제한{" "}
                                                    {problem.timeLimitMs ?? "-"}{" "}
                                                    ms | 메모리 제한{" "}
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
                            );
                        })}
                        {problems.length === 0 && (
                            <ListItem>
                                <ListItemText primary="등록된 문제가 없습니다." />
                            </ListItem>
                        )}
                    </List>
                </CardContent>
            </Card>
        </Stack>
    );
}
