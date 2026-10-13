import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,

    {
        rules: {
            // Mandatory: only const, never let/var
            "no-var": "error",
            "no-restricted-syntax": [
                "error",
                {
                    selector: "VariableDeclaration[kind='let']",
                    message: "Only const is allowed in this project."
                }
            ],

            // Use `debug` instead of console.log (green item)
            "no-console": "error"
        }
    },

    globalIgnores([
        // Default ignores of eslint-config-next:
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
        // Generated output from the tools in your stack:
        "storybook-static/**",
        "coverage/**",
        "playwright-report/**",
        "test-results/**"
    ])
]);

export default eslintConfig;
