import type { RequestHandler } from "express";
import type { ImagesRepository } from "../images/images.types.js";
import type { QuotaService } from "../quotas/quota.service.js";
import { createSmartCreateController } from "./smart-create.controller.js";
import { createSmartCreateRouter } from "./smart-create.routes.js";
import { createSmartCreateResolver } from "./smart-create.geoapify.js";
import { createSmartCreateService, type SmartCreateResolver } from "./smart-create.service.js";
export function createSmartCreateModule(
    attachUser: RequestHandler,
    repository: ImagesRepository,
    quota: QuotaService,
    resolver?: SmartCreateResolver
) {
    const service = createSmartCreateService(repository, resolver ?? createSmartCreateResolver(quota));
    return { service, router: createSmartCreateRouter(attachUser, createSmartCreateController(service)) };
}
