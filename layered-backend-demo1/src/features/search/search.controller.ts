import type { RequestHandler } from "express";

import { env } from "../../config/env.js";
import { AppError } from "../../shared/app-error.js";
import type { SearchRequest, SuggestionsRequest } from "./search.schemas.js";
import type { SearchService } from "./search.service.js";

export interface SearchController {
    search: RequestHandler;
    suggestions: RequestHandler;
    reindex: RequestHandler;
    health: RequestHandler;
}

function canReindex(req: Parameters<RequestHandler>[0]): boolean {
    if (env.NODE_ENV !== "production") {
        return true;
    }

    const providedKey = req.header("x-search-reindex-key");
    return env.SEARCH_REINDEX_KEY !== undefined && providedKey === env.SEARCH_REINDEX_KEY;
}

export function createSearchController(service: SearchService): SearchController {
    const search: RequestHandler = async (req, res) => {
        const { query } = req.validated as SearchRequest;
        const result = await service.search({
            query: query.q,
            entityType: query.entityType,
            country: query.country,
            category: query.category,
            page: query.page,
            limit: query.limit
        });
        res.json({ data: result });
    };

    const suggestions: RequestHandler = async (req, res) => {
        const { query } = req.validated as SuggestionsRequest;
        const results = await service.suggestions(query.q, query.limit);
        res.json({ data: results });
    };

    const reindex: RequestHandler = async (req, res) => {
        if (!canReindex(req)) {
            throw new AppError(403, "Search reindex is restricted to development or administrators");
        }

        const count = await service.reindex();
        res.json({ data: { indexed: count, index: "roamboard-search-v1" } });
    };

    const health: RequestHandler = async (_req, res) => {
        const ready = await service.isReady();
        res.status(ready ? 200 : 503).json({
            status: ready ? "ok" : "unavailable",
            service: "elasticsearch"
        });
    };

    return { search, suggestions, reindex, health };
}
