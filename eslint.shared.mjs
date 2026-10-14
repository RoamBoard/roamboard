import prettier from "eslint-config-prettier/flat";

// Both applications keep their framework presets and use these common code rules.
export const sharedRules = {
    "no-var": "error",
    "prefer-const": "error",
    eqeqeq: ["error", "always"],
    "no-console": "error"
};

// Apply last so Prettier owns formatting without competing ESLint rules.
export const prettierCompatibility = prettier;
