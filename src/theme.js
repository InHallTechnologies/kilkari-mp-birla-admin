import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const customConfig = defineConfig({
    globalCss: {
        "html, body": { fontFamily: "'Noto Sans', system-ui, sans-serif", bg: "#f4f7fa", color: "#1a202c" },
    },
    theme: {
        tokens: {
            colors: {
                brand: {
                    green: { value: "#2fa571" },
                    teal: { value: "#1e8884" },
                    blue: { value: "#1470a4" },
                },
            },
        },
    },
});

export const system = createSystem(defaultConfig, customConfig);
