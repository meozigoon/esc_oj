import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "katex/dist/katex.min.css";
import App from "./App";
import "./styles/global.css";
import { devtoolsBanner } from "./devtoolsBanner";
import { ThemeModeProvider } from "./themeMode";

const knownExtensionAsyncResponseErrors = [
    "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received",
    "The message port closed before a response was received",
];

function getRejectionMessage(reason: unknown): string {
    if (reason instanceof Error) {
        return reason.message;
    }
    if (typeof reason === "string") {
        return reason;
    }
    if (
        reason &&
        typeof reason === "object" &&
        "message" in reason &&
        typeof (reason as { message?: unknown }).message === "string"
    ) {
        return (reason as { message: string }).message;
    }
    return "";
}

function installUnhandledRejectionGuard() {
    window.addEventListener("unhandledrejection", (event) => {
        const message = getRejectionMessage(event.reason);
        if (!message) {
            return;
        }
        if (
            knownExtensionAsyncResponseErrors.some((known) =>
                message.includes(known),
            )
        ) {
            event.preventDefault();
        }
    });
}

installUnhandledRejectionGuard();

if (import.meta.env.DEV && devtoolsBanner.trim()) {
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
    </React.StrictMode>,
);
