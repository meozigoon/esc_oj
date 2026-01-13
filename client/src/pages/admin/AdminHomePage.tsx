import { Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import PageHeader from "../../components/PageHeader";
import { Link } from "react-router-dom";

const items = [
    {
        title: "Contests",
        description: "대회 생성 및 편집",
        to: "/admin/contests",
    },
    {
        title: "Problems",
        description: "문제 및 테스트케이스 관리",
        to: "/admin/problems",
    },
    {
        title: "Submissions",
        description: "전체 제출 조회",
        to: "/admin/submissions",
    },
    {
        title: "Summary",
        description: "참가자/문제별 집계",
        to: "/admin/summary",
    },
    { title: "Users", description: "계정 생성 및 관리", to: "/admin/users" },
    {
        title: "Access Logs",
        description: "접속 기록 조회",
        to: "/admin/access-logs",
    },
    {
        title: "Memo",
        description: "공유 메모장",
        to: "/admin/memo",
    },
];

export default function AdminHomePage() {
    return (
        <Stack spacing={3}>
            <PageHeader title="Admin Dashboard" />
            <Grid container spacing={3}>
                {items.map((item) => (
                    <Grid item xs={12} md={6} key={item.title}>
                        <Card
                            component={Link}
                            to={item.to}
                            sx={{ textDecoration: "none" }}
                        >
                            <CardContent>
                                <Typography variant="h6" fontWeight={700}>
                                    {item.title}
                                </Typography>
                                <Typography color="text.secondary">
                                    {item.description}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Stack>
    );
}
