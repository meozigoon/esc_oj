import {
    Box,
    Button,
    Card,
    CardContent,
    IconButton,
    InputAdornment,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import { useAuth } from "../auth";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const { refresh } = useAuth();

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await apiFetch("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({ username, password }),
            });
            await refresh();
            navigate("/contests");
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "로그인에 실패했습니다."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 420, mx: "auto" }}>
            <Card
                sx={{
                    borderRadius: 2,
                    boxShadow: "0 20px 50px rgba(16,24,40,0.08)",
                }}
            >
                <CardContent>
                    <Stack spacing={2} component="form" onSubmit={handleSubmit}>
                        <Typography variant="h5" fontWeight={700}>
                            로그인
                        </Typography>
                        <TextField
                            label="아이디"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                        <TextField
                            label="비밀번호"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() =>
                                                setShowPassword((prev) => !prev)
                                            }
                                            onMouseDown={(event) =>
                                                event.preventDefault()
                                            }
                                            edge="end"
                                            aria-label="비밀번호 보기"
                                        >
                                            {showPassword ? (
                                                <VisibilityOff />
                                            ) : (
                                                <Visibility />
                                            )}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                        {error && (
                            <Typography color="error" variant="body2">
                                {error}
                            </Typography>
                        )}
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={loading}
                        >
                            로그인
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        </Box>
    );
}
