import { createProviderRouter } from "./provider.routes.js";
import { createProviderService } from "./provider.service.js";
import { createMemoryGooglePlaceReferenceRepository } from "./provider.google-place-repository.js";
import type { GooglePlaceReferenceRepository } from "./provider.types.js";
import type { QuotaService } from "../quotas/quota.service.js";

export function createProviderModule(
    quota: QuotaService,
    googlePlaceReferences: GooglePlaceReferenceRepository = createMemoryGooglePlaceReferenceRepository()
) {
    const service = createProviderService(quota, googlePlaceReferences);
    return { router: createProviderRouter(service), service };
}
