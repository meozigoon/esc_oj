import { Box, Stack, Typography } from "@mui/material";
import { ReactNode } from "react";

type PageHeaderProps = {
    title: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
};

export default function PageHeader({
    title,
    subtitle,
    actions,
}: PageHeaderProps) {
    return (
        <Stack spacing={1.25}>
            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
            >
                <Typography variant="h4">{title}</Typography>
                {actions ? (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            flexWrap: "wrap",
                        }}
                    >
                        {actions}
                    </Box>
                ) : null}
            </Stack>
            {subtitle ? (
                <Typography color="text.secondary">{subtitle}</Typography>
            ) : null}
        </Stack>
    );
}
