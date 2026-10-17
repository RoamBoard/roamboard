import type { DestinationResult } from "./destination.types.js";

export interface DestinationCandidate {
    destination: DestinationResult;
    names: string[];
    qualifiers: string[];
}

function searchText(value: string) {
    return value
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/ø/g, "o")
        .replace(/ł/g, "l")
        .replace(/ß/g, "ss")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .replace(/^the\s+/, "");
}

// Mapbox can classify transport facilities (including Arlanda) as administrative places.
// This is a label safeguard, not an authoritative settlement or population classification.
const transportFacility =
    /\b(?:airports?|aerodromes?|airfields?|heliports?|(?:railway|train|bus)\s+stations?|(?:bus|ferry)\s+terminals?)\b/i;

function spellingSimilarity(query: string, name: string) {
    const input = Array.from(query);
    const target = Array.from(name);
    const distances = Array.from({ length: input.length + 1 }, (_, row) =>
        Array.from({ length: target.length + 1 }, (_, column) => (row === 0 ? column : column === 0 ? row : 0))
    );
    for (let row = 1; row <= input.length; row++) {
        for (let column = 1; column <= target.length; column++) {
            const cost = input[row - 1] === target[column - 1] ? 0 : 1;
            distances[row]![column] = Math.min(
                distances[row - 1]![column]! + 1,
                distances[row]![column - 1]! + 1,
                distances[row - 1]![column - 1]! + cost
            );
            if (
                row > 1 &&
                column > 1 &&
                input[row - 1] === target[column - 2] &&
                input[row - 2] === target[column - 1]
            ) {
                distances[row]![column] = Math.min(distances[row]![column]!, distances[row - 2]![column - 2]! + 1);
            }
        }
    }
    return 1 - distances[input.length]![target.length]! / Math.max(1, input.length, target.length);
}

function matchStrength(candidate: DestinationCandidate, query: string) {
    const names = candidate.names.map(searchText).filter(Boolean);
    const words = query.split(" ");
    const qualifiers = candidate.qualifiers.map(searchText).join(" ").split(" ");
    const exact = names.some((name) => name === query);
    const qualified = names.some((name) => {
        const nameWords = name.split(" ");
        const remaining = words.filter((word) => !nameWords.includes(word));
        return (
            remaining.length > 0 &&
            nameWords.every((word) => words.includes(word)) &&
            remaining.every((word) => qualifiers.includes(word))
        );
    });
    // Short input is usually still being typed: "San" must retain prominent prefix matches.
    if ((query.length >= 4 && exact) || qualified) return { tier: 4, similarity: 1 };
    // Compare whole names before long prefixes, so a one-letter spelling variant of
    // a city can beat a province whose much longer name merely starts with the query.
    const similarity = Math.max(0, ...names.map((name) => spellingSimilarity(query, name)));
    if (Array.from(query).length >= 5 && similarity >= 0.8) return { tier: 3, similarity };
    if (names.some((name) => name.startsWith(query))) return { tier: 2, similarity: 0 };
    return { tier: 1, similarity: 0 };
}

export function destinationSuggestions(candidates: DestinationCandidate[], query: string, limit: number) {
    const normalizedQuery = searchText(query);
    const ranked = candidates
        .filter(
            ({ destination, names }) =>
                ["place", "region", "country"].includes(destination.placeType) &&
                !names.some((name) => transportFacility.test(name))
        )
        .map((candidate, index) => ({ candidate, index, ...matchStrength(candidate, normalizedQuery) }));
    const strongestTier = Math.max(1, ...ranked.map((result) => result.tier));
    const seenNames = new Set<string>();
    const seenIds = new Set<string>();
    return ranked
        .filter((result) => result.tier === strongestTier)
        .sort((left, right) => (left.tier === 3 ? right.similarity - left.similarity : 0) || left.index - right.index)
        .map(({ candidate }) => candidate.destination)
        .filter((result) => {
            const name = searchText(result.name);
            if (!name || seenNames.has(name) || seenIds.has(result.id)) return false;
            // For equally strong names retain provider prominence, including when it selects
            // a province over a small namesake town. Never infer population from map geometry.
            seenNames.add(name);
            seenIds.add(result.id);
            return true;
        })
        .slice(0, limit);
}
