import {
    Button,
    Card,
    CardContent,
    FormControl,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useCallback, useEffect, useState } from "react";
import { AdminUser, apiFetch, formatDateTime, Role } from "../../api";
import { useAuth } from "../../auth";

const roleOptions: Array<{ value: Role; label: string }> = [
    { value: "user", label: "User" },
    { value: "admin", label: "Admin" },
    { value: "viewer", label: "Viewer" },
];

const passwordChars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz1234567890!@#$%^&*()?<>+=-";

const generatePassword = (length = 6) => {
    const values = new Uint32Array(length);
    if (
        globalThis.crypto &&
        typeof globalThis.crypto.getRandomValues === "function"
    ) {
        globalThis.crypto.getRandomValues(values);
        return Array.from(
            values,
            (value) => passwordChars[value % passwordChars.length]
        ).join("");
    }
    let fallback = "";
    for (let i = 0; i < length; i += 1) {
        fallback +=
            passwordChars[Math.floor(Math.random() * passwordChars.length)];
    }
    return fallback;
};

export default function AdminUsersPage() {
    const { user: currentUser } = useAuth();
    const isReadOnly = currentUser?.role === "viewer";
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmCreatePassword, setConfirmCreatePassword] = useState("");
    const [role, setRole] = useState<Role>("user");
    const [error, setError] = useState<string | null>(null);
    const [passwordUserId, setPasswordUserId] = useState<number | "">("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
    const [showCreatePassword, setShowCreatePassword] = useState(false);
    const [showCreateConfirmPassword, setShowCreateConfirmPassword] =
        useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

    const fetchUsers = useCallback(() => {
        setError(null);
        apiFetch<{ users: AdminUser[] }>("/api/admin/users")
            .then((data) => setUsers(data.users))
            .catch((err) =>
                setError(
                    err instanceof Error
                        ? err.message
                        : "계정을 불러오지 못했습니다."
                )
            );
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const createPasswordMismatch =
        password.trim().length > 0 &&
        confirmCreatePassword.trim().length > 0 &&
        password !== confirmCreatePassword;
    const createPasswordReady =
        password.trim().length >= 4 && password === confirmCreatePassword;

    const handleGeneratePassword = () => {
        const generated = generatePassword();
        setPassword(generated);
        setConfirmCreatePassword(generated);
        setError(null);
    };

    const renderPasswordAdornment = (
        visible: boolean,
        toggle: () => void,
        label: string
    ) => (
        <InputAdornment position="end">
            <IconButton
                onClick={toggle}
                onMouseDown={(event) => event.preventDefault()}
                edge="end"
                aria-label={`${label} 보기`}
            >
                {visible ? <VisibilityOff /> : <Visibility />}
            </IconButton>
        </InputAdornment>
    );

    const handleCreate = async () => {
        setError(null);
        if (!createPasswordReady) {
            setError("비밀번호 확인이 필요합니다.");
            return;
        }
        try {
            await apiFetch("/api/admin/users", {
                method: "POST",
                body: JSON.stringify({ username, password, role }),
            });
            setUsername("");
            setPassword("");
            setConfirmCreatePassword("");
            setRole("user");
            fetchUsers();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "계정 생성에 실패했습니다."
            );
        }
    };

    const handlePasswordChange = async () => {
        setPasswordError(null);
        setPasswordSuccess(null);
        if (!passwordUserId) {
            setPasswordError("대상 계정을 선택해 주세요.");
            return;
        }
        if (newPassword.trim().length < 4) {
            setPasswordError("비밀번호를 확인해 주세요.");
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setPasswordError("비밀번호가 일치하지 않습니다.");
            return;
        }

        try {
            await apiFetch(`/api/admin/users/${passwordUserId}/password`, {
                method: "PUT",
                body: JSON.stringify({ password: newPassword }),
            });
            setPasswordUserId("");
            setNewPassword("");
            setConfirmNewPassword("");
            setPasswordSuccess("비밀번호가 변경되었습니다.");
        } catch (err) {
            setPasswordError(
                err instanceof Error
                    ? err.message
                    : "비밀번호 변경에 실패했습니다."
            );
        }
    };

    const handleDeleteUser = async (target: AdminUser) => {
        if (
            !confirm(
                `'${target.username}' 계정을 삭제할까요?\n삭제하면 제출 기록과 접근 로그도 함께 삭제됩니다.`
            )
        ) {
            return;
        }
        setError(null);
        try {
            await apiFetch(`/api/admin/users/${target.id}`, {
                method: "DELETE",
            });
            if (passwordUserId === target.id) {
                setPasswordUserId("");
            }
            fetchUsers();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "계정 삭제에 실패했습니다."
            );
        }
    };

    return (
        <Stack spacing={3}>
            <Typography variant="h4" fontWeight={700}>
                Users
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
                            새 계정 생성
                        </Typography>
                        <TextField
                            label="아이디"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={isReadOnly}
                        />
                        <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            alignItems={{ sm: "flex-start" }}
                        >
                            <TextField
                                label="비밀번호"
                                type={showCreatePassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isReadOnly}
                                sx={{ flex: 1 }}
                                InputProps={{
                                    endAdornment: renderPasswordAdornment(
                                        showCreatePassword,
                                        () =>
                                            setShowCreatePassword(
                                                (prev) => !prev
                                            ),
                                        "비밀번호"
                                    ),
                                }}
                            />
                            <Button
                                variant="outlined"
                                onClick={handleGeneratePassword}
                                disabled={isReadOnly}
                                sx={{ whiteSpace: "nowrap", height: 56 }}
                            >
                                랜덤 생성
                            </Button>
                        </Stack>
                        <TextField
                            label="비밀번호 확인"
                            type={
                                showCreateConfirmPassword ? "text" : "password"
                            }
                            value={confirmCreatePassword}
                            onChange={(e) =>
                                setConfirmCreatePassword(e.target.value)
                            }
                            disabled={isReadOnly}
                            error={createPasswordMismatch}
                            helperText={
                                createPasswordMismatch
                                    ? "비밀번호가 일치하지 않습니다."
                                    : undefined
                            }
                            InputProps={{
                                endAdornment: renderPasswordAdornment(
                                    showCreateConfirmPassword,
                                    () =>
                                        setShowCreateConfirmPassword(
                                            (prev) => !prev
                                        ),
                                    "비밀번호 확인"
                                ),
                            }}
                        />
                        <FormControl>
                            <InputLabel id="role-label">권한</InputLabel>
                            <Select
                                labelId="role-label"
                                label="권한"
                                value={role}
                                onChange={(e) =>
                                    setRole(e.target.value as Role)
                                }
                                disabled={isReadOnly}
                            >
                                {roleOptions.map((option) => (
                                    <MenuItem
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button
                            variant="contained"
                            onClick={handleCreate}
                            disabled={isReadOnly || !createPasswordReady}
                        >
                            생성
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

            <Card
                sx={{
                    borderRadius: 2,
                    boxShadow: "0 16px 40px rgba(16,24,40,0.08)",
                }}
            >
                <CardContent>
                    <Stack spacing={2}>
                        <Typography variant="h6" fontWeight={700}>
                            비밀번호 변경
                        </Typography>
                        {passwordError && (
                            <Typography color="error">
                                {passwordError}
                            </Typography>
                        )}
                        {passwordSuccess && (
                            <Typography color="primary">
                                {passwordSuccess}
                            </Typography>
                        )}
                        <FormControl>
                            <InputLabel id="user-select-label">
                                대상 계정
                            </InputLabel>
                            <Select
                                labelId="user-select-label"
                                label="대상 계정"
                                value={passwordUserId}
                                onChange={(e) =>
                                    setPasswordUserId(
                                        e.target.value === ""
                                            ? ""
                                            : Number(e.target.value)
                                    )
                                }
                                disabled={isReadOnly}
                            >
                                <MenuItem value="">선택</MenuItem>
                                {users.map((user) => (
                                    <MenuItem key={user.id} value={user.id}>
                                        {user.username} (#{user.id})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            label="새 비밀번호"
                            type={showNewPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={isReadOnly}
                            InputProps={{
                                endAdornment: renderPasswordAdornment(
                                    showNewPassword,
                                    () => setShowNewPassword((prev) => !prev),
                                    "새 비밀번호"
                                ),
                            }}
                        />
                        <TextField
                            label="새 비밀번호 확인"
                            type={showConfirmNewPassword ? "text" : "password"}
                            value={confirmNewPassword}
                            onChange={(e) =>
                                setConfirmNewPassword(e.target.value)
                            }
                            disabled={isReadOnly}
                            InputProps={{
                                endAdornment: renderPasswordAdornment(
                                    showConfirmNewPassword,
                                    () =>
                                        setShowConfirmNewPassword(
                                            (prev) => !prev
                                        ),
                                    "새 비밀번호 확인"
                                ),
                            }}
                        />
                        <Button
                            variant="contained"
                            onClick={handlePasswordChange}
                            disabled={isReadOnly}
                        >
                            변경
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

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
                                <TableCell>권한</TableCell>
                                <TableCell>생성일</TableCell>
                                <TableCell>관리</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>{user.id}</TableCell>
                                    <TableCell>{user.username}</TableCell>
                                    <TableCell>{user.role}</TableCell>
                                    <TableCell>
                                        {formatDateTime(user.createdAt)}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            color="error"
                                            variant="outlined"
                                            size="small"
                                            onClick={() =>
                                                handleDeleteUser(user)
                                            }
                                            disabled={isReadOnly}
                                        >
                                            삭제
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </Stack>
    );
}
