import {
  Button,
  Card,
  CardContent,
  FormControl,
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
  Typography
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { AdminUser, apiFetch, formatDateTime, Role } from '../../api';

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' }
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    apiFetch<{ users: AdminUser[] }>('/api/admin/users')
      .then((data) => setUsers(data.users))
      .catch((err) => setError(err instanceof Error ? err.message : '계정을 불러오지 못했습니다.'));
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async () => {
    setError(null);
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username, password, role })
      });
      setUsername('');
      setPassword('');
      setRole('user');
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '계정 생성에 실패했습니다.');
    }
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h4" fontWeight={700}>
        Users
      </Typography>
      {error && <Typography color="error">{error}</Typography>}

      <Card sx={{ borderRadius: 2, boxShadow: '0 16px 40px rgba(16,24,40,0.08)' }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={700}>
              새 계정 생성
            </Typography>
            <TextField label="아이디" value={username} onChange={(e) => setUsername(e.target.value)} />
            <TextField
              label="비밀번호"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FormControl>
              <InputLabel id="role-label">권한</InputLabel>
              <Select
                labelId="role-label"
                label="권한"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {roleOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={handleCreate}>
              생성
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 2, boxShadow: '0 16px 40px rgba(16,24,40,0.08)' }}>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>아이디</TableCell>
                <TableCell>권한</TableCell>
                <TableCell>생성일</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>{formatDateTime(user.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  );
}
