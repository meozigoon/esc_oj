import {
    Box,
    Button,
    Card,
    CardContent,
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
import { apiFetch } from "../../api";

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

export default function AdminSummaryPage() {
    const [tab, setTab] = useState(0);
    const [contestId, setContestId] = useState("");
    const [userRows, setUserRows] = useState<UserSummaryRow[]>([]);
    const [problemRows, setProblemRows] = useState<ProblemSummaryRow[]>([]);
    const [search, setSearch] = useState("");
    const [error, setError] = useState<string | null>(null);

    const fetchSummary = useCallback(async () => {
        setError(null);
        const params = new URLSearchParams();
        if (contestId) {
            params.set("contestId", contestId);
        }
        try {
            const userData = await apiFetch<{ rows: UserSummaryRow[] }>(
                `/api/admin/summary/by-user?${params.toString()}`
            );
            const problemData = await apiFetch<{ rows: ProblemSummaryRow[] }>(
                `/api/admin/summary/by-problem?${params.toString()}`
            );
            setUserRows(userData.rows);
            setProblemRows(problemData.rows);
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
                            <TextField
                                label="Contest ID (선택)"
                                value={contestId}
                                onChange={(e) => setContestId(e.target.value)}
                            />
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
            </Tabs>

            <Card
                sx={{
                    borderRadius: 2,
                    boxShadow: "0 16px 40px rgba(16,24,40,0.08)",
                }}
            >
                <CardContent>
                    {tab === 0 ? (
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
                    ) : (
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
                </CardContent>
            </Card>
        </Stack>
    );
}
