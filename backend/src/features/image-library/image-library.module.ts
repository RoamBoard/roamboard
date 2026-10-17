import type { RequestHandler } from "express";
import type { QuotaService } from "../quotas/quota.service.js";
import { createLibraryRepository } from "./image-library.repository.js";
import { createLibraryProvider } from "./image-library.provider.js";
import { createLibraryService } from "./image-library.service.js";
import { createLibraryController } from "./image-library.controller.js";
import { createLibraryRouter } from "./image-library.routes.js";
import type { LibraryProvider, LibraryRepository } from "./image-library.types.js";

export function createLibraryModule(
    attachUser: RequestHandler,
    quota: QuotaService,
    repository?: LibraryRepository,
    provider?: LibraryProvider
) {
    const service = createLibraryService(
        repository ?? createLibraryRepository(),
        provider ?? createLibraryProvider(quota)
    );
    return { router: createLibraryRouter(createLibraryController(service), attachUser) };
}
