import { rankDocuments, suggestDocuments } from "./search.ranking.js";
import type { SearchDocument, SearchInput, SearchResult, SearchSourceRepository } from "./search.types.js";
export interface SearchService {
    ensureIndex(): Promise<void>;
    reindex(): Promise<number>;
    search(input: SearchInput): Promise<SearchResult>;
    suggestions(query: string, limit: number): Promise<string[]>;
    isReady(): Promise<boolean>;
    index(document: SearchDocument): Promise<void>;
    remove(boardId: string): Promise<void>;
}
export function createSearchService(sourceRepository: SearchSourceRepository): SearchService {
    return {
        async ensureIndex() {
            await sourceRepository.findAll();
        },
        async reindex() {
            return (await sourceRepository.findAll()).filter((document) => document.isPublic).length;
        },
        async search(input) {
            return rankDocuments(await sourceRepository.findAll(), { ...input, q: input.query });
        },
        async suggestions(query, limit) {
            return suggestDocuments(await sourceRepository.findAll(), query, limit);
        },
        async isReady() {
            try {
                await sourceRepository.findAll();
                return true;
            } catch {
                return false;
            }
        },
        // Board writes already update the search source within their PostgreSQL transaction.
        async index() {},
        async remove() {}
    };
}
