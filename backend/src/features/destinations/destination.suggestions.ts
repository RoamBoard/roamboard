import type { DestinationResult } from "./destination.types.js";

function cityName(value: string) {
    return value
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
}

// Mapbox can classify transport facilities (including Arlanda) as administrative places.
// This is a label safeguard, not an authoritative settlement or population classification.
const transportFacility =
    /\b(?:airports?|aerodromes?|airfields?|heliports?|(?:railway|train|bus)\s+stations?|(?:bus|ferry)\s+terminals?)\b/i;

export function destinationSuggestions(results: DestinationResult[], limit: number) {
    const seenNames = new Set<string>();
    const seenIds = new Set<string>();
    return results
        .filter((result) => {
            if (result.placeType !== "place" || transportFacility.test(result.name)) return false;
            const name = cityName(result.name);
            if (!name || seenNames.has(name) || seenIds.has(result.id)) return false;
            // Preserve Mapbox prominence/relevance order. A country/region in the query lets
            // Mapbox promote a smaller namesake; a population threshold would exclude it.
            seenNames.add(name);
            seenIds.add(result.id);
            return true;
        })
        .slice(0, limit);
}
