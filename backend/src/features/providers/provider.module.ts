import type { RequestHandler } from "express";
import { createProviderController } from "./provider.controller.js";
import { createProviderRouter } from "./provider.routes.js";
import { createProviderService } from "./provider.service.js";
import { createPostgresGooglePlaceReferenceRepository } from "./provider.repository.js";
import type { QuotaService } from "../quotas/quota.service.js";

export function createProviderModule(quota: QuotaService, attachUser: RequestHandler) {
    const repository = createPostgresGooglePlaceReferenceRepository();
    const service = createProviderService(quota, repository);
    return { service, router: createProviderRouter(createProviderController(service), attachUser) };
}
