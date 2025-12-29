import {
    Button,
    Card,
    CardContent,
    Grid,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, Contest, formatDateTime } from "../../api";
import { useAuth } from "../../auth";

function toLocalInput(value: Date) {
    const offset = value.getTimezoneOffset();
    const adjusted = new Date(value.getTime() - offset * 60000);
    return adjusted.toISOString().slice(0, 16);
}

export default function AdminContestsPage() {
    const { user } = useAuth();
    const isReadOnly = user?.role === "viewer";
    const [contests, setContests] = useState<Contest[]>([]);
    const [title, setTitle] = useState("");
    const [startAt, setStartAt] = useState(toLocalInput(new Date()));
    const [endAt, setEndAt] = useState(
        toLocalInput(new Date(Date.now() + 3600000))
    );
    const [error, setError] = useState<string | null>(null);

    const fetchContests = useCallback(() => {
        setError(null);
        apiFetch<{ contests: Contest[] }>("/api/admin/contests")
            .then((data) => setContests(data.contests))
            .catch((err) =>
                setError(
                    err instanceof Error
                        ? err.message
                        : "대회를 불러오지 못했습니다."
                )
            );
    }, []);

    useEffect(() => {
        fetchContests();
    }, [fetchContests]);

    const handleCreate = async () => {
        setError(null);
        try {
            await apiFetch("/api/admin/contests", {
                method: "POST",
                body: JSON.stringify({ title, startAt, endAt }),
            });
            setTitle("");
            fetchContests();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "대회 생성에 실패했습니다."
            );
        }
    };

    const handleDelete = async (contestId: number) => {
        if (!confirm("대회를 삭제할까요?")) {
            return;
        }
        setError(null);
        try {
            await apiFetch(`/api/admin/contests/${contestId}`, {
                method: "DELETE",
            });
            fetchContests();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "대회 삭제에 실패했습니다."
            );
        }
    };

    return (
        <Stack spacing={3}>
            <Typography variant="h4" fontWeight={700}>
                Contests
            </Typography>
            {error && <Typography color="error">{error}</Typography>}

            <Card
                sx={{
                    borderRadius: 2,
                    boxShadow: "0 16px 40px rgba(16,24,40,0.08)",
                }}
            >
                <CardContent>
                    <Stack spacing={2}>
                        <Typography variant="h6" fontWeight={700}>
                            새 대회 생성
                        </Typography>
                        <TextField
                            label="제목"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={isReadOnly}
                        />
                        <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={2}
                        >
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
                        </Stack>
                        <Button
                            variant="contained"
                            onClick={handleCreate}
                            disabled={isReadOnly}
                        >
                            생성
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

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
                                <Stack spacing={1}>
                                    <Typography variant="h6" fontWeight={700}>
                                        {contest.title}
                                    </Typography>
                                    <Typography color="text.secondary">
                                        {formatDateTime(contest.startAt)} -{" "}
                                        {formatDateTime(contest.endAt)}
                                    </Typography>
                                    <Stack direction="row" spacing={2}>
                                        <Button
                                            component={Link}
                                            to={`/admin/contests/${contest.id}`}
                                            variant="outlined"
                                        >
                                            {isReadOnly ? "보기" : "편집"}
                                        </Button>
                                        <Button
                                            color="error"
                                            onClick={() =>
                                                handleDelete(contest.id)
                                            }
                                            disabled={isReadOnly}
                                        >
                                            삭제
                                        </Button>
                                    </Stack>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Stack>
    );
}
