import type { RequestHandler } from "express";
import type { SearchInput } from "./search.types.js";
import { createSearchService } from "./search.service.js";

export function createSearchController(service: ReturnType<typeof createSearchService>) {
    return {
        search: (async (_request, response) => {
            response.json({ data: await service.search(response.locals.query as SearchInput) });
        }) as RequestHandler,
        suggestions: (async (_request, response) => {
            const { q, limit } = response.locals.query as { q: string; limit: number };
            response.json({ data: await service.suggestions(q, limit) });
        }) as RequestHandler
    };
}
