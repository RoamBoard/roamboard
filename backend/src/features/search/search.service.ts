import type { SearchRepository, SearchProvider, SearchInput } from "./search.types.js";

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
        }
    };
}
