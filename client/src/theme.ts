import { PaletteMode, createTheme } from "@mui/material/styles";

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
    return createTheme({
        palette: {
            mode,
            primary: { main: "#1f7a8c" },
            secondary: { main: "#f4a261" },
            background: palette.background,
            text: palette.text,
        },
        typography: {
            fontFamily:
                '"Space Grotesk", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
            h1: { fontWeight: 700 },
            h2: { fontWeight: 700 },
            h3: { fontWeight: 600 },
            button: { textTransform: "none", fontWeight: 600 },
        },
        shape: {
            borderRadius: 8,
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
                        borderRadius: 6,
                    },
                },
            },
        },
    });
}
