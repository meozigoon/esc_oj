import {
    AppBar,
    Box,
    Button,
    Container,
    IconButton,
    Link as MuiLink,
    Toolbar,
    Tooltip,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { DarkMode, LightMode } from "@mui/icons-material";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useThemeMode } from "../themeMode";

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const theme = useTheme();
    const { mode, toggleMode } = useThemeMode();
    const githubUrl =
        import.meta.env.VITE_GITHUB_URL ??
        "https://github.com/meozigoon/hssh_oj";
    const year = new Date().getFullYear();
    const appBarBg = alpha(
        theme.palette.background.paper,
        theme.palette.mode === "dark" ? 0.9 : 0.8
    );
    const appBarBorder =
        theme.palette.mode === "dark"
            ? "rgba(148, 163, 184, 0.18)"
            : "rgba(15, 23, 42, 0.08)";

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <Box
            sx={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <AppBar
                position="sticky"
                elevation={0}
                sx={{
                    background: appBarBg,
                    backdropFilter: "blur(10px)",
                    borderBottom: `1px solid ${appBarBorder}`,
                }}
            >
                <Toolbar sx={{ gap: 2 }}>
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 700,
                            color: "primary.main",
                            flexGrow: 1,
                        }}
                        component={Link}
                        to="/"
                    >
                        ESC OJ
                    </Typography>
                    <Button
                        component={Link}
                        to="/"
                        variant="outlined"
                        color="primary"
                    >
                        Home
                    </Button>
                    {user && (
                        <Button
                            component={Link}
                            to="/submissions"
                            variant="outlined"
                            color="primary"
                        >
                            My Submissions
                        </Button>
                    )}
                    {(user?.role === "admin" || user?.role === "viewer") && (
                        <Button
                            component={Link}
                            to="/admin"
                            variant="outlined"
                            color="primary"
                        >
                            Admin
                        </Button>
                    )}
                    {user ? (
                        <Button
                            onClick={handleLogout}
                            variant="outlined"
                            color="primary"
                        >
                            Logout ({user.username})
                        </Button>
                    ) : (
                        <Button
                            component={Link}
                            to="/login"
                            variant="contained"
                            color="primary"
                        >
                            Login
                        </Button>
                    )}
                </Toolbar>
            </AppBar>
            <Container sx={{ py: 4, flex: 1 }}>
                <Outlet />
            </Container>
            <Box
                sx={{
                    position: "fixed",
                    right: 20,
                    bottom: 20,
                    zIndex: 1200,
                }}
            >
                <Tooltip title={mode === "dark" ? "라이트 모드" : "다크 모드"}>
                    <IconButton
                        onClick={toggleMode}
                        color="primary"
                        aria-label="toggle color mode"
                        sx={{
                            backgroundColor: theme.palette.background.paper,
                            border: "1px solid",
                            borderColor: appBarBorder,
                            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.18)",
                            "&:hover": {
                                backgroundColor: theme.palette.background.paper,
                            },
                        }}
                    >
                        {mode === "dark" ? <LightMode /> : <DarkMode />}
                    </IconButton>
                </Tooltip>
            </Box>
            <Box
                component="footer"
                sx={{ borderTop: `1px solid ${appBarBorder}`, py: 2 }}
            >
                <Container
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 2,
                    }}
                >
                    <Typography variant="body2" color="text.secondary">
                        © {year} DH.L. All rights reserved.
                    </Typography>
                    <MuiLink
                        href={githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        underline="hover"
                        color="text.secondary"
                    >
                        GitHub
                    </MuiLink>
                </Container>
            </Box>
        </Box>
    );
}
