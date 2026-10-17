import { readFileSync } from "node:fs";

// UN M49 region mapping: https://unstats.un.org/unsd/methodology/m49/overview/
const continents = JSON.parse(
    readFileSync(new URL("../../../shared/country-continents.json", import.meta.url), "utf8")
) as Record<string, string>;

export function continentForCountry(code: string): string | null {
    return continents[code] ?? null;
}
