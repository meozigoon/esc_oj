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
    Tab,
    Tabs,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, Contest } from "../../api";

type UserSummaryRow = {
    id: number;
    username: string;
    total: number;
    accepted: number;
};

type ProblemSummaryRow = {
    id: number;
    title: string;
    total: number;
    accepted: number;
};

type LeaderboardRow = {
    rank: number;
    id: number;
    username: string;
    score: number;
    wrongs: number;
};

export default function AdminSummaryPage() {
    const [tab, setTab] = useState(0);
    const [contestId, setContestId] = useState("");
    const [contests, setContests] = useState<Contest[]>([]);
    const [userRows, setUserRows] = useState<UserSummaryRow[]>([]);
    const [problemRows, setProblemRows] = useState<ProblemSummaryRow[]>([]);
    const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>(
        []
    );
    const [search, setSearch] = useState("");
    const [error, setError] = useState<string | null>(null);

    const fetchSummary = useCallback(async () => {
        setError(null);
        const params = new URLSearchParams();
        if (contestId) {
            params.set("contestId", contestId);
        }
        try {
            const [userData, problemData] = await Promise.all([
                apiFetch<{ rows: UserSummaryRow[] }>(
                    `/api/admin/summary/by-user?${params.toString()}`
                ),
                apiFetch<{ rows: ProblemSummaryRow[] }>(
                    `/api/admin/summary/by-problem?${params.toString()}`
                ),
            ]);
            setUserRows(userData.rows);
            setProblemRows(problemData.rows);
            if (contestId) {
                const leaderboardData = await apiFetch<{
                    rows: LeaderboardRow[];
                }>(`/api/admin/leaderboard?contestId=${contestId}`);
                setLeaderboardRows(leaderboardData.rows);
            } else {
                setLeaderboardRows([]);
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "요약 정보를 불러오지 못했습니다."
            );
        }
    }, [contestId]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    useEffect(() => {
        apiFetch<{ contests: Contest[] }>("/api/admin/contests")
            .then((data) => setContests(data.contests))
            .catch(() => undefined);
    }, []);

    const filteredUsers = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return userRows;
        return userRows.filter((row) =>
            row.username.toLowerCase().includes(keyword)
        );
    }, [search, userRows]);

    const filteredProblems = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return problemRows;
        return problemRows.filter((row) =>
            row.title.toLowerCase().includes(keyword)
        );
    }, [search, problemRows]);

    const filteredLeaderboard = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return leaderboardRows;
        return leaderboardRows.filter((row) =>
            row.username.toLowerCase().includes(keyword)
        );
    }, [leaderboardRows, search]);

    return (
        <Stack spacing={3}>
            <Typography variant="h4" fontWeight={700}>
                Summary
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
                            필터
                        </Typography>
                        <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={2}
                            alignItems="center"
                        >
                            <FormControl sx={{ minWidth: 220 }}>
                                <InputLabel id="contest-select-label">
                                    대회
                                </InputLabel>
                                <Select
                                    labelId="contest-select-label"
                                    label="대회"
                                    value={contestId}
                                    onChange={(e) =>
                                        setContestId(String(e.target.value))
                                    }
                                >
                                    <MenuItem value="">전체</MenuItem>
                                    {contests.map((contest) => (
                                        <MenuItem
                                            key={contest.id}
                                            value={String(contest.id)}
                                        >
                                            {contest.title} (#{contest.id})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <TextField
                                label="검색"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                sx={{ flex: 1 }}
                            />
                            <Button variant="contained" onClick={fetchSummary}>
                                조회
                            </Button>
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>

            <Tabs value={tab} onChange={(_, value) => setTab(value)}>
                <Tab label="참가자별" />
                <Tab label="문제별" />
                <Tab label="순위" />
            </Tabs>

            <Card
                sx={{
                    borderRadius: 2,
                    boxShadow: "0 16px 40px rgba(16,24,40,0.08)",
                }}
            >
                <CardContent>
                    {tab === 0 && (
                        <Box>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>유저</TableCell>
                                        <TableCell>총 제출</TableCell>
                                        <TableCell>정답</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredUsers.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell>
                                                {row.username}
                                            </TableCell>
                                            <TableCell>{row.total}</TableCell>
                                            <TableCell>
                                                {row.accepted}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Box>
                    )}
                    {tab === 1 && (
                        <Box>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>문제</TableCell>
                                        <TableCell>총 제출</TableCell>
                                        <TableCell>정답</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredProblems.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell>{row.title}</TableCell>
                                            <TableCell>{row.total}</TableCell>
                                            <TableCell>
                                                {row.accepted}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Box>
                    )}
                    {tab === 2 && (
                        <Box>
                            {!contestId ? (
                                <Typography color="text.secondary">
                                    대회를 선택하면 순위표를 확인할 수 있습니다.
                                </Typography>
                            ) : (
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>순위</TableCell>
                                            <TableCell>참가자</TableCell>
                                            <TableCell>점수</TableCell>
                                            <TableCell>오답</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredLeaderboard.map((row) => (
                                            <TableRow key={row.id}>
                                                <TableCell>
                                                    {row.rank}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        component={Link}
                                                        to={`/admin/submissions?contestId=${contestId}&userId=${row.id}`}
                                                        size="small"
                                                    >
                                                        {row.username}
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    {row.score}
                                                </TableCell>
                                                <TableCell>
                                                    {row.wrongs}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {filteredLeaderboard.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4}>
                                                    데이터가 없습니다.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </Box>
                    )}
                </CardContent>
            </Card>
        </Stack>
    );
}
