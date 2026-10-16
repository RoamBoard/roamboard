import type { SearchProvider, SearchRepository } from "./search.types.js";
import { createSearchRepository } from "./search.repository.js";
import { createSearchProvider } from "./search.postgres.js";
import { createSearchService } from "./search.service.js";
import { createSearchController } from "./search.controller.js";
import { createSearchRouter } from "./search.routes.js";

export function createSearchModule(
    repository: SearchRepository = createSearchRepository(),
    provider: SearchProvider = createSearchProvider(repository)
) {
    const service = createSearchService(repository, provider);
    return { service, router: createSearchRouter(createSearchController(service)) };
}
