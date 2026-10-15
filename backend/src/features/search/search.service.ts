import type { SearchRepository, SearchProvider, SearchInput } from "./search.types.js";
import { SEARCH_INDEX } from "./search.elasticsearch.js";

export function createSearchService(repository: SearchRepository, provider: SearchProvider) {
    return {
        async search(input: SearchInput) {
            const publicIds = await repository.listPublicIds();
            const result = await provider.search(input, publicIds);
            const current = await repository.listPublic([...new Set(result.hits.map((hit) => hit.id))]);
            const byId = new Map(current.map((document) => [document.id, document]));
            return {
                hits: result.hits.flatMap((hit) => {
                    const document = byId.get(hit.id);
                    return document ? [{ document, score: hit.score }] : [];
                }),
                total: result.total,
                page: input.page,
                limit: input.limit
            };
        },
        async suggestions(query: string, limit: number) {
            const publicIds = await repository.listPublicIds();
            const ids = await provider.suggestions(query, limit, publicIds);
            const current = await repository.listPublic([...new Set(ids)]);
            const byId = new Map(current.map((document) => [document.id, document.title]));
            return [
                ...new Set(
                    ids.flatMap((id) => {
                        const title = byId.get(id);
                        return title === undefined ? [] : [title];
                    })
                )
            ];
        },
        async reindex() {
            const documents = await repository.listPublic();
            await provider.replace(documents);
            return { indexed: documents.length, index: SEARCH_INDEX };
        },
        async refreshBoard(boardId: number) {
            const documents = await repository.listPublic([String(boardId)]);
            await provider.update(boardId, documents[0] ?? null);
        }
    };
}
