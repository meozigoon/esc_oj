import {
    Box,
    Button,
    Card,
    CardContent,
    Grid,
    Stack,
    Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { banner } from "../banner";

type QuickLink = {
    title: string;
    to: string;
    cta: string;
    requiresAuth?: boolean;
    requiresAdmin?: boolean;
};

const quickLinks: QuickLink[] = [
    {
        title: "로그인",
        to: "/login",
        cta: "로그인",
    },
    {
        title: "대회",
        to: "/contests",
        cta: "대회 보기",
        requiresAuth: true,
    },
    {
        title: "내 제출",
        to: "/submissions",
        cta: "제출 기록",
        requiresAuth: true,
    },
    {
        title: "관리자",
        to: "/admin",
        cta: "관리자 이동",
        requiresAdmin: true,
    },
];

export default function HomePage() {
    const { user } = useAuth();
    const isAdminUser = user?.role === "admin" || user?.role === "viewer";
    const visibleLinks = quickLinks.filter(
        (link) => !link.requiresAdmin || isAdminUser
    );

    return (
        <Stack spacing={4}>
            <Box
                sx={{
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: 2,
                    p: { xs: 3, md: 6 },
                    background:
                        "linear-gradient(135deg, rgba(31,122,140,0.18) 0%, rgba(244,162,97,0.2) 40%, rgba(42,157,143,0.18) 100%)",
                    border: "1px solid rgba(15, 23, 42, 0.08)",
                }}
            >
                <Box
                    sx={{
                        position: "absolute",
                        width: 220,
                        height: 220,
                        borderRadius: "50%",
                        background:
                            "radial-gradient(circle, rgba(31,122,140,0.35), transparent 70%)",
                        top: -60,
                        right: -40,
                        filter: "blur(2px)",
                    }}
                />
                <Box
                    sx={{
                        position: "absolute",
                        width: 180,
                        height: 180,
                        borderRadius: "36% 64% 48% 52%",
                        background:
                            "radial-gradient(circle, rgba(244,162,97,0.35), transparent 70%)",
                        bottom: -40,
                        left: -30,
                        filter: "blur(2px)",
                    }}
                />
                <Stack
                    spacing={2}
                    sx={{ position: "relative", zIndex: 1, maxWidth: 680 }}
                >
                    <Box
                        component="pre"
                        sx={{
                            fontFamily: "monospace",
                            fontSize: { xs: "1.4rem", md: "1.8rem" },
                            lineHeight: 1,
                            color: "text.primary",
                            m: 0,
                        }}
                    >
                        {banner}
                    </Box>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                        <Button
                            component={Link}
                            to={user ? "/contests" : "/login"}
                            variant="contained"
                            size="large"
                        >
                            {user ? "대회 시작하기" : "로그인하고 시작하기"}
                        </Button>
                        {!user && (
                            <Button
                                component={Link}
                                to="/login"
                                variant="outlined"
                                size="large"
                            >
                                로그인
                            </Button>
                        )}
                        {user && (
                            <Button
                                component={Link}
                                to="/submissions"
                                variant="outlined"
                                size="large"
                            >
                                내 제출
                            </Button>
                        )}
                    </Stack>
                </Stack>
            </Box>

            <Grid container spacing={3}>
                {visibleLinks.map((link) => {
                    const isAdminOnly = link.requiresAdmin && !isAdminUser;
                    const isLoginRequired = link.requiresAuth && !user;
                    const isLoginLink = link.title === "로그인";
                    const isLoggedIn = Boolean(user);

                    let cta = link.cta;
                    let to = link.to;
                    let disabled = false;

                    if (isLoginLink && isLoggedIn) {
                        cta = "로그인됨";
                        to = "/contests";
                        disabled = true;
                    } else if (isAdminOnly) {
                        cta = "관리자 전용";
                        to = "/login";
                    } else if (isLoginRequired) {
                        cta = "로그인 필요";
                        to = "/login";
                    }

                    return (
                        <Grid item xs={12} md={6} key={link.title}>
                            <Card
                                sx={{
                                    borderRadius: 2,
                                    boxShadow:
                                        "0 16px 40px rgba(16,24,40,0.08)",
                                    height: "100%",
                                }}
                            >
                                <CardContent>
                                    <Stack spacing={1.5}>
                                        <Typography
                                            variant="h6"
                                            fontWeight={700}
                                        >
                                            {link.title}
                                        </Typography>
                                        <Box>
                                            <Button
                                                component={Link}
                                                to={to}
                                                variant="outlined"
                                                disabled={disabled}
                                            >
                                                {cta}
                                            </Button>
                                        </Box>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>
        </Stack>
    );
}
