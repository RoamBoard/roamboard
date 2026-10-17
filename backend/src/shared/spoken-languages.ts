import { readFileSync } from "node:fs";

export const spokenLanguages = JSON.parse(
    readFileSync(new URL("../../../shared/spoken-languages.json", import.meta.url), "utf8")
) as string[];
