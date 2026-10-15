import countryCodePairs from "../../../shared/country-codes.json";

export type Country = {
    code: string;
    name: string;
};

const alpha2ToAlpha3: Record<string, string> = countryCodePairs;
const alpha3Codes = new Set(Object.values(alpha2ToAlpha3));
const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

export const countries: Country[] = Object.entries(alpha2ToAlpha3)
    .map(([alpha2, code]) => ({ code, name: displayNames.of(alpha2) ?? code }))
    .sort((left, right) => left.name.localeCompare(right.name));

export function toCountryCode(value: string): string | null {
    const code = value.trim().toUpperCase();
    return alpha2ToAlpha3[code] ?? (alpha3Codes.has(code) ? code : null);
}

const aliases = new Map<string, string>([
    ["america", "USA"],
    ["britain", "GBR"],
    ["england", "GBR"],
    ["great britain", "GBR"],
    ["uk", "GBR"],
    ["united states of america", "USA"],
    ["usa", "USA"]
]);

function normalize(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function editDistance(left: string, right: string): number {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    return (
        [...left].reduce((row, leftCharacter, leftIndex) => {
            const next = [leftIndex + 1];
            [...right].forEach((rightCharacter, rightIndex) => {
                next.push(
                    Math.min(
                        (next[rightIndex] ?? 0) + 1,
                        (row[rightIndex + 1] ?? 0) + 1,
                        (row[rightIndex] ?? 0) + (leftCharacter === rightCharacter ? 0 : 1)
                    )
                );
            });
            return next;
        }, previous)[right.length] ?? right.length
    );
}

export function findCountry(value: string): Country | undefined {
    const query = normalize(value);
    const aliasCode = toCountryCode(aliases.get(query) ?? value);
    return countries.find(
        (country) =>
            normalize(country.name) === query || country.code.toLowerCase() === query || country.code === aliasCode
    );
}

export function suggestCountries(value: string, limit = 6): Country[] {
    const query = normalize(value);
    if (!query) return [];

    return countries
        .map((country) => {
            const name = normalize(country.name);
            const aliasMatches = [...aliases].some(
                ([alias, code]) => toCountryCode(code) === country.code && alias.startsWith(query)
            );
            const distance = editDistance(query, name);
            const score =
                name === query || country.code.toLowerCase() === query
                    ? 0
                    : name.startsWith(query) || aliasMatches
                      ? 1
                      : name.includes(query)
                        ? 2
                        : 3 + distance;
            return { country, distance, score };
        })
        .filter(
            ({ country, distance, score }) =>
                score <= 2 || distance <= Math.max(2, Math.floor(normalize(country.name).length * 0.3))
        )
        .sort(
            (left, right) =>
                left.score - right.score ||
                left.distance - right.distance ||
                left.country.name.localeCompare(right.country.name)
        )
        .slice(0, limit)
        .map(({ country }) => country);
}
