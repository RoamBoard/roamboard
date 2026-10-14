import { readFileSync } from "node:fs";

const alpha2ToAlpha3 = JSON.parse(
    readFileSync(new URL("../../../shared/country-codes.json", import.meta.url), "utf8")
) as Record<string, string>;
const alpha3ToAlpha2 = new Map(Object.entries(alpha2ToAlpha3).map(([alpha2, alpha3]) => [alpha3, alpha2]));
const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

export function isCountryCode(value: string): boolean {
    return alpha3ToAlpha2.has(value);
}

export function toCountryCode(value: string): string | null {
    const code = value.trim().toUpperCase();
    return alpha2ToAlpha3[code] ?? (isCountryCode(code) ? code : null);
}

export function toAlpha2CountryCode(value: string): string | null {
    const code = toCountryCode(value);
    return code ? (alpha3ToAlpha2.get(code) ?? null) : null;
}

export function countryName(code: string): string {
    const alpha2 = toAlpha2CountryCode(code);
    return alpha2 ? (displayNames.of(alpha2) ?? code) : code;
}

export function countryCodeForName(name: string): string | null {
    return (
        toCountryCode(name) ??
        [...alpha3ToAlpha2.keys()].find((code) => countryName(code).toLowerCase() === name.trim().toLowerCase()) ??
        null
    );
}
