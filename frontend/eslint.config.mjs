import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { prettierCompatibility, sharedRules } from "../eslint.shared.mjs";

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,

    {
        rules: {
            ...sharedRules,
            // The frontend retains its existing const-only requirement.
            "no-restricted-syntax": [
                "error",
                {
                    selector: "VariableDeclaration[kind='let']",
                    message: "Only const is allowed in this project."
                }
            ]
        }
    },

    globalIgnores([
        // Default ignores of eslint-config-next:
        "**/.next/**",
        "**/out/**",
        "**/build/**",
        "**/next-env.d.ts",
        // Generated output from the tools in your stack:
        "**/storybook-static/**",
        "**/coverage/**",
        "**/playwright-report/**",
        "**/test-results/**"
    ]),
    prettierCompatibility
]);

export default eslintConfig;
