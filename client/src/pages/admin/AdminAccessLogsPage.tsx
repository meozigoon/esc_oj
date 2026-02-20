import {
    Button,
    Card,
    CardContent,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { AccessLog, apiFetch, formatDateTime } from "../../api";
import PageHeader from "../../components/PageHeader";

export default function AdminAccessLogsPage() {
    const [logs, setLogs] = useState<AccessLog[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [nextOffset, setNextOffset] = useState<number | null>(null);
    const limit = 200;

    useEffect(() => {
        const load = async () => {
            setError(null);
            setLoading(true);
            try {
                const data = await apiFetch<{
                    logs: AccessLog[];
                    nextOffset: number | null;
                }>(`/api/admin/access-logs?limit=${limit}&offset=0`);
                setLogs(data.logs);
                setNextOffset(data.nextOffset);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "접속 기록을 불러오지 못했습니다.",
                );
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

    const handleLoadMore = async () => {
        if (nextOffset === null || loading) {
            return;
        }
        setLoading(true);
        try {
            const data = await apiFetch<{
                logs: AccessLog[];
                nextOffset: number | null;
            }>(`/api/admin/access-logs?limit=${limit}&offset=${nextOffset}`);
            setLogs((prev) => [...prev, ...data.logs]);
            setNextOffset(data.nextOffset);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "접속 기록을 불러오지 못했습니다.",
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <Stack spacing={3}>
            <PageHeader title="Access Logs" />
            {error && <Typography color="error">{error}</Typography>}

            <Card>
                <CardContent>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>ID</TableCell>
                                <TableCell>아이디</TableCell>
                                <TableCell>접속 시각</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell>{log.id}</TableCell>
                                    <TableCell>{log.user.username}</TableCell>
                                    <TableCell>
                                        {formatDateTime(log.createdAt)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {logs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3}>
                                        <Typography color="text.secondary">
                                            기록이 없습니다.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    {nextOffset !== null && (
                        <Stack direction="row" justifyContent="center" mt={2}>
                            <Button
                                variant="outlined"
                                onClick={handleLoadMore}
                                disabled={loading}
                            >
                                {loading ? "불러오는 중..." : "더 보기"}
                            </Button>
                        </Stack>
                    )}
                </CardContent>
            </Card>
        </Stack>
    );
}
