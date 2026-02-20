const js = require("@eslint/js");
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const reactPlugin = require("eslint-plugin-react");
const reactHooksPlugin = require("eslint-plugin-react-hooks");
const globals = require("globals");

const unusedVarsRule = [
    "error",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
];

module.exports = [
    {
        ignores: [
            "**/node_modules/**",
            "**/dist/**",
            "data/**",
            "coverage/**",
            ".github/**",
        ],
    },
    js.configs.recommended,
    {
        files: ["server/src/**/*.ts", "worker/src/**/*.ts"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                sourceType: "module",
                ecmaVersion: 2021,
            },
            globals: {
                ...globals.node,
                ...globals.es2021,
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            "no-undef": "off",
            "@typescript-eslint/no-unused-vars": unusedVarsRule,
        },
    },
    {
        files: ["client/src/**/*.{ts,tsx}"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                sourceType: "module",
                ecmaVersion: 2021,
                ecmaFeatures: { jsx: true },
            },
            globals: {
                ...globals.browser,
                ...globals.es2021,
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
            react: reactPlugin,
            "react-hooks": reactHooksPlugin,
        },
        settings: {
            react: { version: "detect" },
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...reactPlugin.configs.recommended.rules,
            "react/react-in-jsx-scope": "off",
            "no-undef": "off",
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
            "@typescript-eslint/no-unused-vars": unusedVarsRule,
        },
    },
];
