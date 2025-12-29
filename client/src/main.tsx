import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import App from "./App";
import "./styles/global.css";
import { devtoolsBanner } from "./devtoolsBanner";
import { ThemeModeProvider } from "./themeMode";

if (devtoolsBanner.trim()) {
    console.log(devtoolsBanner);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ThemeModeProvider>
            <BrowserRouter
                future={{
                    v7_startTransition: true,
                    v7_relativeSplatPath: true,
                }}
            >
                <App />
            </BrowserRouter>
        </ThemeModeProvider>
    </React.StrictMode>
);
