import type { RequestHandler } from "express";
import type { SearchProvider, SearchRepository } from "./search.types.js";
import { createSearchRepository } from "./search.repository.js";
import { createSearchProvider } from "./search.elasticsearch.js";
import { createSearchService } from "./search.service.js";
import { createSearchController } from "./search.controller.js";
import { createSearchRouter } from "./search.routes.js";

export function createSearchModule(
    attachUser: RequestHandler,
    repository: SearchRepository = createSearchRepository(),
    provider: SearchProvider = createSearchProvider()
) {
    const service = createSearchService(repository, provider);
    return { service, router: createSearchRouter(createSearchController(service), attachUser) };
}
