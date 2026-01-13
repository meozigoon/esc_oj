import { PaletteMode } from "@mui/material";
import { createTheme } from "@mui/material/styles";

const paletteByMode: Record<
    PaletteMode,
    {
        background: { default: string; paper: string };
        text: { primary: string; secondary: string };
    }
> = {
    light: {
        background: {
            default: "#f6f7fb",
            paper: "#ffffff",
        },
        text: {
            primary: "#1f2937",
            secondary: "#4b5563",
        },
    },
    dark: {
        background: {
            default: "#0f172a",
            paper: "#111827",
        },
        text: {
            primary: "#f9fafb",
            secondary: "#cbd5e1",
        },
    },
};

export function getTheme(mode: PaletteMode) {
    const palette = paletteByMode[mode];
    const divider =
        mode === "dark"
            ? "rgba(148, 163, 184, 0.18)"
            : "rgba(15, 23, 42, 0.08)";
    return createTheme({
        palette: {
            mode,
            primary: { main: "#1f7a8c" },
            secondary: { main: "#f4a261" },
            background: palette.background,
            text: palette.text,
            divider,
        },
        typography: {
            fontFamily:
                '"Space Grotesk", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
            h1: { fontWeight: 700 },
            h2: { fontWeight: 700 },
            h3: { fontWeight: 700 },
            h4: { fontWeight: 700 },
            h5: { fontWeight: 600 },
            h6: { fontWeight: 600 },
            button: { textTransform: "none", fontWeight: 600 },
        },
        shape: {
            borderRadius: 12,
        },
        components: {
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: "none",
                    },
                },
            },
            MuiButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 10,
                    },
                    sizeSmall: {
                        minHeight: 32,
                        paddingInline: 12,
                    },
                    sizeMedium: {
                        minHeight: 40,
                        paddingInline: 18,
                    },
                    sizeLarge: {
                        minHeight: 48,
                        paddingInline: 22,
                    },
                },
            },
            MuiCard: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        borderRadius: 16,
                        border: `1px solid ${theme.palette.divider}`,
                        boxShadow:
                            theme.palette.mode === "dark"
                                ? "0 18px 36px rgba(2, 6, 23, 0.55)"
                                : "0 16px 40px rgba(16, 24, 40, 0.08)",
                    }),
                },
            },
            MuiCardContent: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        padding: theme.spacing(3),
                        "&:last-child": {
                            paddingBottom: theme.spacing(3),
                        },
                    }),
                },
            },
        },
    });
}
