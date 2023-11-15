module.exports = {
    root: true,
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint"],
    parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
    },
    env: {
        es2021: true,
        node: true,
    },
    rules: {
        semi: ["error", "always"],
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
};
