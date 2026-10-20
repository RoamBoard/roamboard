import { countryName } from "../../shared/countries.js";
import type { DiscoveryCandidate, DiscoveryQuery, LocationInterpretation, Place } from "./discovery.types.js";

export const normalize = (text: string) => text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
const words = (text: string): string[] => normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
const phrase = (text: string, term: string) => ` ${words(text).join(" ")} `.includes(` ${words(term).join(" ")} `);
const synonyms = [
    ["food", "restaurant", "restaurants", "dining", "cuisine", "cafe", "cafes"],
    ["cafe", "cafes", "coffee", "coffeeshop"],
    ["quiet", "relaxed", "peaceful", "calm", "tranquil"],
    ["hike", "hiking", "trek", "trekking"],
    ["museum", "museums", "gallery", "galleries"],
    ["beach", "beaches", "seaside", "coast"],
    ["nightlife", "bars", "bar", "clubs", "club"]
];
const descriptors = new Set(["quiet", "relaxed", "peaceful", "calm", "tranquil", "beautiful", "nice", "best"]);
const ignored = new Set(["in", "the", "a", "an", "and", "with", "for", "of", "to"]);
const placeText = (place: Place) =>
    [place.name, place.city, place.country, place.address, place.country ? countryName(place.country) : ""]
        .filter(Boolean)
        .join(" ");

export function rankSearch(boards: DiscoveryCandidate[], input: DiscoveryQuery, catalog: Place[] = []) {
    const queryWords = words(input.q);
    if (queryWords.length === 0) return { boards: [], location: null };
    const places = [
        ...catalog.map((place) => ({ place, primary: true })),
        ...boards.flatMap((board) => [
            ...(board.destination ? [{ place: board.destination, primary: true }] : []),
            ...board.locations.map((place) => ({ place, primary: false }))
        ])
    ];
    // Common destinations stay recognized even before the first Board there is published.
    places.push(
        ...[
            { name: "Stockholm", city: "Stockholm", country: "SWE", address: null },
            { name: "Paris", city: "Paris", country: "FRA", address: "France" },
            { name: "Paris", city: "Paris", country: "USA", address: "Texas, United States" }
        ].map((place) => ({ place, primary: true }))
    );
    // Use canonical city/country and primary destination names, never a Board title or note as a place.
    const names = new Set(
        places
            .flatMap(({ place, primary }) => [
                place.city,
                primary ? place.name : null,
                place.country ? countryName(place.country) : null
            ])
            .filter((name): name is string => Boolean(name))
    );
    const exact = [...names]
        .filter((name) => phrase(input.q, name))
        .sort((a, b) => words(b).length - words(a).length || b.length - a.length);
    const lastWord = queryWords.at(-1)!;
    const prefixes =
        lastWord.length >= 3 ? [...names].filter((name) => words(name).some((part) => part.startsWith(lastWord))) : [];
    const terms = input.location === "off" ? [] : exact.length ? [exact[0]!] : prefixes;
    const term = terms.length ? (exact.length ? exact[0]! : lastWord) : undefined;
    const hasPlaceName = (place: Place, primary: boolean) =>
        terms.some(
            (name) =>
                phrase(place.city ?? "", name) ||
                (primary && phrase(place.name, name)) ||
                (place.country !== null && phrase(countryName(place.country), name))
        );
    const locationTerms = new Set(words(term ?? ""));
    const remaining = queryWords.filter(
        (word) =>
            !locationTerms.has(word) &&
            !(term && word.length >= 3 && words(term).some((part) => part.startsWith(word))) &&
            !ignored.has(word)
    );
    const matchingPlaces = term ? places.filter(({ place, primary }) => hasPlaceName(place, primary)) : [];
    // Only consume explicit qualifiers supported by canonical place metadata, e.g. Texas or France.
    const qualifiers = term
        ? remaining.filter((word) => matchingPlaces.some(({ place }) => words(placeText(place)).includes(word)))
        : [];
    const topics = remaining.filter((word) => !qualifiers.includes(word));
    const matchesPlace = (place: Place, primary: boolean) =>
        Boolean(
            term &&
            hasPlaceName(place, primary) &&
            qualifiers.every((qualifier) => words(placeText(place)).includes(qualifier))
        );
    const location: LocationInterpretation = term
        ? {
              term,
              label: qualifiers.length
                  ? [term, ...qualifiers].join(", ")
                  : normalize(term) === "paris"
                    ? "Paris, France (other places named Paris included)"
                    : !exact.length && prefixes.length > 1
                      ? `Places matching “${term}”`
                      : terms[0]!
          }
        : null;
    const ranked = boards
        .filter((board) => !board.owned)
        .flatMap((board) => {
            const primary = board.destination ? matchesPlace(board.destination, true) : false;
            const activity = board.locations.some((place) => matchesPlace(place, false));
            if (term && !primary && !activity) return [];
            const text = words([board.title, board.description, ...board.tags, board.activityText].join(" "));
            const topicScore = topics.reduce((score, word) => {
                const alternatives = new Set([word, ...synonyms.filter((group) => group.includes(word)).flat()]);
                const direct = text.some((token) => token === word || (word.length >= 3 && token.startsWith(word)));
                const related = text.some((token) => alternatives.has(token));
                return score + (direct ? 10 : related ? 7 : 0) * (descriptors.has(word) ? 0.25 : 1);
            }, 0);
            if (!term && topicScore === 0) return [];
            const parisFrance =
                term &&
                normalize(term) === "paris" &&
                !qualifiers.length &&
                [board.destination, ...board.locations].some(
                    (place) => place?.country === "FRA" && matchesPlace(place, place === board.destination)
                );
            return [{ board, score: topicScore + (primary ? 1 : 0), placePriority: parisFrance ? 1 : 0 }];
        })
        .sort(
            (a, b) =>
                b.placePriority - a.placePriority ||
                b.score - a.score ||
                b.board.savedCount - a.board.savedCount ||
                b.board.updatedAt.localeCompare(a.board.updatedAt) ||
                b.board.boardId - a.board.boardId
        );
    return { boards: ranked.map(({ board }) => board), location };
}

export function featuredBoards(boards: DiscoveryCandidate[]) {
    const score = (board: DiscoveryCandidate) =>
        board.viewers + board.guests * 0.5 + board.savers * 5 + board.commenters * 5;
    const recent = (a: DiscoveryCandidate, b: DiscoveryCandidate) =>
        (b.firstPublishedAt ?? "").localeCompare(a.firstPublishedAt ?? "") || b.boardId - a.boardId;
    const active = boards
        .filter((board) => board.visibility === "public" && score(board) > 0)
        .sort((a, b) => score(b) - score(a) || b.savers - a.savers || b.commenters - a.commenters || recent(a, b));
    const activeIds = new Set(active.map((board) => board.boardId));
    return [
        ...active,
        ...boards.filter((board) => board.visibility === "public" && !activeIds.has(board.boardId)).sort(recent),
        ...boards.filter((board) => board.visibility === "friends").sort(recent)
    ].slice(0, 10);
}
