import {
    AppBar,
    Box,
    Button,
    Container,
    Link as MuiLink,
    Toolbar,
    Typography,
} from "@mui/material";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const githubUrl =
        import.meta.env.VITE_GITHUB_URL ??
        "https://github.com/meozigoon/hssh_oj";
    const year = new Date().getFullYear();

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
                sx={{ background: "#ffffffcc", backdropFilter: "blur(10px)" }}
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
                component="footer"
                sx={{ borderTop: "1px solid rgba(15, 23, 42, 0.08)", py: 2 }}
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
