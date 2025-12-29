import {
    Box,
    Button,
    Card,
    CardContent,
    Grid,
    Stack,
    Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, Contest, formatDateTime } from "../api";
import Countdown from "../components/Countdown";

export default function ContestListPage() {
    const [contests, setContests] = useState<Contest[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setError(null);
        apiFetch<{ contests: Contest[] }>("/api/contests")
            .then((data) => setContests(data.contests))
            .catch((err) =>
                setError(
                    err instanceof Error
                        ? err.message
                        : "대회를 불러오지 못했습니다."
                )
            );
    }, []);

    return (
        <Box>
            <Stack spacing={1} mb={3}>
                <Typography variant="h4" fontWeight={700}>
                    Contests
                </Typography>
                <Typography color="text.secondary">
                    동일 LAN 환경에서 진행되는 로컬 대회 목록입니다.
                </Typography>
            </Stack>
            {error && (
                <Typography color="error" mb={2}>
                    {error}
                </Typography>
            )}
            <Grid container spacing={3}>
                {contests.map((contest) => (
                    <Grid item xs={12} md={6} key={contest.id}>
                        <Card
                            sx={{
                                borderRadius: 2,
                                boxShadow: "0 16px 40px rgba(16,24,40,0.08)",
                            }}
                        >
                            <CardContent>
                                <Stack spacing={2}>
                                    <Typography variant="h6" fontWeight={700}>
                                        {contest.title}
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        {formatDateTime(contest.startAt)} -{" "}
                                        {formatDateTime(contest.endAt)}
                                    </Typography>
                                    <Countdown
                                        startAt={contest.startAt}
                                        endAt={contest.endAt}
                                    />
                                    <Button
                                        component={Link}
                                        to={`/contests/${contest.id}`}
                                        variant="contained"
                                        color="primary"
                                    >
                                        대회 보기
                                    </Button>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
}
