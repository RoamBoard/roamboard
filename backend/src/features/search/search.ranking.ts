interface SearchableDocument {
    id: string;
    entityType: string;
    title: string;
    description: string;
    city: string;
    country: string;
    tags: string[];
    categories: string[];
    isPublic: boolean;
}
interface RankingInput {
    q: string;
    entityType?: string;
    country?: string;
    category?: string;
    page: number;
    limit: number;
}
function words(value: string): string[] {
    return (
        value
            .toLocaleLowerCase("en")
            .normalize("NFKD")
            .replace(/\p{M}/gu, "")
            .match(/[\p{L}\p{N}]+/gu) ?? []
    );
}
function distance(left: string, right: string): number {
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i++) {
        const current = [i];
        for (let j = 1; j <= right.length; j++) {
            current[j] = Math.min(
                current[j - 1]! + 1,
                previous[j]! + 1,
                previous[j - 1]! + (left[i - 1] === right[j - 1] ? 0 : 1)
            );
        }
        previous = current;
    }
    return previous[right.length]!;
}
export function rankDocuments<T extends SearchableDocument>(documents: T[], input: RankingInput) {
    const terms = words(input.q);
    const hits = documents
        .filter(
            (document) =>
                document.isPublic &&
                (!input.entityType || document.entityType === input.entityType) &&
                (!input.country ||
                    document.country
                        .split(",")
                        .some((country) => country.trim().toLowerCase() === input.country!.trim().toLowerCase())) &&
                (!input.category ||
                    document.categories.some((category) => category.toLowerCase() === input.category!.toLowerCase()))
        )
        .map((document) => {
            const fields: Array<[string, number]> = [
                [document.title, 5],
                [document.city, 3],
                [document.country, 2],
                [document.tags.join(" "), 1],
                [document.description, 1]
            ];
            const score = terms.reduce(
                (total, term) =>
                    total +
                    Math.max(
                        0,
                        ...fields.map(([value, weight]) => {
                            const tokens = words(value);
                            const tolerance = term.length < 3 ? 0 : term.length < 6 ? 1 : 2;
                            return tokens.some((token) => token === term)
                                ? weight * 2
                                : tokens.some(
                                        (token) =>
                                            Math.abs(token.length - term.length) <= tolerance &&
                                            distance(token, term) <= tolerance
                                    )
                                  ? weight
                                  : 0;
                        })
                    ),
                0
            );
            return { document, score };
        })
        .filter((hit) => hit.score > 0)
        .sort((a, b) => b.score - a.score || a.document.id.localeCompare(b.document.id));
    return {
        hits: hits.slice((input.page - 1) * input.limit, input.page * input.limit),
        total: hits.length,
        page: input.page,
        limit: input.limit
    };
}
export function suggestDocuments<T extends SearchableDocument>(documents: T[], query: string, limit: number): string[] {
    const terms = words(query);
    if (!terms.length) return [];
    return [
        ...new Set(
            documents
                .filter(
                    (document) =>
                        document.isPublic &&
                        terms.every((term) => words(document.title).some((word) => word.startsWith(term)))
                )
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((document) => document.title)
        )
    ].slice(0, limit);
}
