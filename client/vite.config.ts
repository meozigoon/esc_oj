import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes("node_modules")) {
                        return undefined;
                    }
                    if (
                        id.includes("react-markdown") ||
                        id.includes("remark-") ||
                        id.includes("rehype-") ||
                        id.includes("unified") ||
                        id.includes("micromark") ||
                        id.includes("mdast") ||
                        id.includes("hast") ||
                        id.includes("vfile")
                    ) {
                        return "markdown-vendor";
                    }
                    if (id.includes("katex")) {
                        return "katex-vendor";
                    }
                    if (
                        id.includes("@mui") ||
                        id.includes("@emotion") ||
                        id.includes("@popperjs")
                    ) {
                        return "mui-vendor";
                    }
                    if (id.includes("react-router")) {
                        return "router-vendor";
                    }
                    if (id.includes("/react/") || id.includes("react-dom")) {
                        return "react-vendor";
                    }
                    return "vendor";
                },
            },
        },
    },
    server: {
        host: true,
        port: 5173,
        proxy: {
            "/api": "http://localhost:3000",
        },
    },
});
