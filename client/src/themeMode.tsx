import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { PaletteMode } from "@mui/material";
import { getTheme } from "./theme";

type ThemeModeContextValue = {
    mode: PaletteMode;
    toggleMode: () => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(
    undefined
);

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
    const [mode, setMode] = useState<PaletteMode>("light");

    const toggleMode = useCallback(() => {
        setMode((prev) => (prev === "light" ? "dark" : "light"));
    }, []);

    const theme = useMemo(() => getTheme(mode), [mode]);

    useEffect(() => {
        document.documentElement.dataset.theme = mode;
    }, [mode]);

    return (
        <ThemeModeContext.Provider value={{ mode, toggleMode }}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ThemeModeContext.Provider>
    );
}

export function useThemeMode() {
    const ctx = useContext(ThemeModeContext);
    if (!ctx) {
        throw new Error("ThemeModeProvider is missing");
    }
    return ctx;
}
