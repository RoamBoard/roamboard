import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import { prettierCompatibility, sharedRules } from "../eslint.shared.mjs";

export default defineConfig(
    {
        ignores: ["dist/**", "node_modules/**"]
    },
    {
        files: ["**/*.{js,ts}"],
        extends: [js.configs.recommended, tseslint.configs.recommended],
        rules: sharedRules
    },
    prettierCompatibility
);
