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
import {
    Link,
    Outlet,
    matchPath,
    useLocation,
    useNavigate,
} from "react-router-dom";
import { useAuth } from "../auth";
import { useThemeMode } from "../themeMode";

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const theme = useTheme();
    const { mode, toggleMode } = useThemeMode();
    const location = useLocation();
    const githubUrl = import.meta.env.VITE_GITHUB_URL;
    const year = new Date().getFullYear();
    const appBarBg = alpha(
        theme.palette.background.paper,
        theme.palette.mode === "dark" ? 0.9 : 0.8,
    );
    const appBarBorder =
        theme.palette.mode === "dark"
            ? "rgba(148, 163, 184, 0.18)"
            : "rgba(15, 23, 42, 0.08)";
    const wideRoutes = [
        "/problems/:id",
        "/problems/:id/submissions",
        "/submissions",
        "/submissions/:id",
    ];
    const isWide = wideRoutes.some((pattern) =>
        matchPath({ path: pattern, end: true }, location.pathname),
    );
    const outerMaxWidth = "xl";
    const contentWidth = isWide
        ? theme.breakpoints.values.xl
        : theme.breakpoints.values.lg;
    const contentBoxSx = {
        width: "100%",
        maxWidth: contentWidth,
        mx: "auto",
    };

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
                <Toolbar disableGutters>
                    <Container
                        maxWidth={outerMaxWidth}
                        sx={{ display: "flex", alignItems: "center" }}
                    >
                        <Box
                            sx={{
                                ...contentBoxSx,
                                display: "flex",
                                alignItems: "center",
                                gap: 2,
                            }}
                        >
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
                                to="/contests"
                                variant="outlined"
                                color="primary"
                            >
                                대회
                            </Button>
                            {user && (
                                <Button
                                    component={Link}
                                    to="/submissions"
                                    variant="outlined"
                                    color="primary"
                                >
                                    제출 기록
                                </Button>
                            )}
                            {(user?.role === "admin" ||
                                user?.role === "viewer") && (
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
                        </Box>
                    </Container>
                </Toolbar>
            </AppBar>
            <Container maxWidth={outerMaxWidth} sx={{ py: 4, flex: 1 }}>
                <Box sx={contentBoxSx}>
                    <Outlet />
                </Box>
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
                    maxWidth={outerMaxWidth}
                    sx={{ display: "flex", alignItems: "center" }}
                >
                    <Box
                        sx={{
                            ...contentBoxSx,
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
                    </Box>
                </Container>
            </Box>
        </Box>
    );
}
