import type { Router } from "express";

import { createSearchController, type SearchController } from "./search.controller.js";
import { sampleSearchDocuments } from "./search.documents.js";
import { createSearchRouter } from "./search.routes.js";
import { createSearchService, type SearchService } from "./search.service.js";
import { createSearchSourceRepository } from "./search.repository.js";
import type { SearchSourceRepository } from "./search.types.js";

interface CreateSearchModuleOptions {
    sourceRepository?: SearchSourceRepository;
}

export interface SearchModule {
    router: Router;
    controller: SearchController;
    service: SearchService;
}

export function createSearchModule({
    sourceRepository = createSearchSourceRepository(sampleSearchDocuments)
}: CreateSearchModuleOptions = {}): SearchModule {
    const service = createSearchService(sourceRepository);
    const controller = createSearchController(service);
    const router = createSearchRouter(controller);

    return { router, controller, service };
}
