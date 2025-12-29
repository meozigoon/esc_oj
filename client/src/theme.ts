import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
    palette: {
        mode: "light",
        primary: { main: "#1f7a8c" },
        secondary: { main: "#f4a261" },
        background: {
            default: "#f6f7fb",
            paper: "#ffffff",
        },
        text: {
            primary: "#1f2937",
            secondary: "#4b5563",
        },
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
