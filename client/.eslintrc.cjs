module.exports = {
    env: {
        browser: true,
        es2021: true,
    },
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
    },
    plugins: ["@typescript-eslint", "react", "react-hooks"],
    extends: [
        "eslint:recommended",
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
        "plugin:@typescript-eslint/recommended",
    ],
    settings: {
        react: { version: "detect" },
    },
    rules: {
        "react/react-in-jsx-scope": "off",
        "@typescript-eslint/no-unused-vars": [
            "error",
            { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
        ],
    },
};
