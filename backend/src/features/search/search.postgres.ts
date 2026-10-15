import type { SearchProvider, SearchRepository } from "./search.types.js";
import { rankDocuments, suggestDocuments } from "./search.ranking.js";
export const SEARCH_INDEX = "postgresql-boards";
// Read canonical PostgreSQL records on every request; there is no separate search store.
export function createSearchProvider(repository: SearchRepository): SearchProvider {
    return {
        async search(input, publicIds) {
            const result = rankDocuments(await repository.listPublic(publicIds), input);
            return {
                hits: result.hits.map(({ document, score }) => ({ id: document.id, score })),
                total: result.total
            };
        },
        async suggestions(query, limit, publicIds) {
            const documents = await repository.listPublic(publicIds);
            const titles = suggestDocuments(documents, query, limit);
            return titles.flatMap((title) =>
                documents.filter((document) => document.title === title).map((document) => document.id)
            );
        },
        // Compatibility hooks: PostgreSQL writes are already current.
        async replace() {},
        async update() {}
    };
}
