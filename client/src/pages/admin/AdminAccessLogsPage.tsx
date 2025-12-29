import {
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

export default function AdminAccessLogsPage() {
    const [logs, setLogs] = useState<AccessLog[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiFetch<{ logs: AccessLog[] }>("/api/admin/access-logs")
            .then((data) => setLogs(data.logs))
            .catch((err) =>
                setError(
                    err instanceof Error
                        ? err.message
                        : "접속 기록을 불러오지 못했습니다."
                )
            );
    }, []);

    return (
        <Stack spacing={3}>
            <Typography variant="h4" fontWeight={700}>
                Access Logs
            </Typography>
            {error && <Typography color="error">{error}</Typography>}

            <Card
                sx={{
                    borderRadius: 2,
                    boxShadow: "0 16px 40px rgba(16,24,40,0.08)",
                }}
            >
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
                </CardContent>
            </Card>
        </Stack>
    );
}
