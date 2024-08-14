import tsEslint from "typescript-eslint";
import prettierEslint from "eslint-config-prettier";

export default [
    ...tsEslint.configs.recommended,
    prettierEslint,
    {
        rules: {
            semi: ["error", "always"],
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        },
    },
];
