import {
    Button,
    Card,
    CardContent,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatDateTime } from "../../api";
import PageHeader from "../../components/PageHeader";
import { useAuth } from "../../auth";

type MemoPayload = {
    content: string;
    updatedAt?: string | null;
};

export default function AdminMemoPage() {
    const { user } = useAuth();
    const isReadOnly = user?.role === "viewer";
    const [content, setContent] = useState("");
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const fetchMemo = useCallback(() => {
        setError(null);
        apiFetch<{ memo: MemoPayload }>("/api/admin/memo")
            .then((data) => {
                setContent(data.memo.content ?? "");
                setUpdatedAt(data.memo.updatedAt ?? null);
            })
            .catch((err) =>
                setError(
                    err instanceof Error ? err.message : "Failed to load memo.",
                ),
            );
    }, []);

    useEffect(() => {
        fetchMemo();
    }, [fetchMemo]);

    const handleSave = async () => {
        if (isReadOnly) {
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const data = await apiFetch<{ memo: MemoPayload }>(
                "/api/admin/memo",
                {
                    method: "PUT",
                    body: JSON.stringify({ content }),
                },
            );
            setContent(data.memo.content ?? "");
            setUpdatedAt(data.memo.updatedAt ?? null);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to save memo.",
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Stack spacing={3}>
            <PageHeader
                title="Memo"
                subtitle={`Last updated: ${updatedAt ? formatDateTime(updatedAt) : "-"}`}
            />
            {isReadOnly && (
                <Typography variant="body2" color="text.secondary">
                    Read-only mode.
                </Typography>
            )}
            {error && <Typography color="error">{error}</Typography>}
            <Card>
                <CardContent>
                    <Stack spacing={2}>
                        <TextField
                            label="Shared memo"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            multiline
                            minRows={12}
                            disabled={isReadOnly}
                        />
                        <Button
                            variant="contained"
                            onClick={handleSave}
                            disabled={isReadOnly || saving}
                        >
                            Save
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        </Stack>
    );
}
