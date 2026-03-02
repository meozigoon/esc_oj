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

const knownExtensionAsyncResponseErrorFragments = [
    "a listener indicated an asynchronous response by returning true",
    "the message channel closed before a response was received",
    "the message port closed before a response was received",
];

function getErrorMessage(value: unknown): string {
    if (value instanceof Error) {
        return value.message;
    }
    if (typeof value === "string") {
        return value;
    }
    if (
        value &&
        typeof value === "object" &&
        "message" in value &&
        typeof (value as { message?: unknown }).message === "string"
    ) {
        return (value as { message: string }).message;
    }
    return "";
}

function isKnownExtensionAsyncResponseError(value: unknown): boolean {
    const message = getErrorMessage(value).toLowerCase();
    if (!message) {
        return false;
    }
    return knownExtensionAsyncResponseErrorFragments.some((fragment) =>
        message.includes(fragment),
    );
}

function installAsyncResponseNoiseGuard() {
    window.addEventListener("unhandledrejection", (event) => {
        if (isKnownExtensionAsyncResponseError(event.reason)) {
            event.preventDefault();
        }
    });

    window.addEventListener("error", (event) => {
        if (
            isKnownExtensionAsyncResponseError(event.error) ||
            isKnownExtensionAsyncResponseError(event.message)
        ) {
            event.preventDefault();
        }
    });

    const originalConsoleError = console.error.bind(console);
    console.error = (...args) => {
        if (args.some((arg) => isKnownExtensionAsyncResponseError(arg))) {
            return;
        }
        originalConsoleError(...args);
    };
}

installAsyncResponseNoiseGuard();

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
