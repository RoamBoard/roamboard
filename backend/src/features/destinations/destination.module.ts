import type { QuotaService } from "../quotas/quota.service.js";
import { createDestinationService, type DestinationGuideDependencies } from "./destination.service.js";
import { createDestinationController } from "./destination.controller.js";
import { createDestinationRouter } from "./destination.routes.js";
import { createDestinationRepository } from "./destination.repository.js";
import { fetchWikivoyageGuide } from "./destination.providers.js";
import { fetchWikivoyageSights, matchMapboxSight } from "./destination.sights.js";
import { searchUnsplash } from "../providers/provider.providers.js";
import { createWikivoyageDetails } from "./destination.details.js";

export function createDestinationModule(quota: QuotaService, options: Partial<DestinationGuideDependencies> = {}) {
    const repository = options.repository ?? createDestinationRepository();
    const details = createWikivoyageDetails(() => quota.reserve("wikipedia.action_api"));
    const providers: DestinationGuideDependencies["providers"] = options.providers ?? {
        article: fetchWikivoyageGuide,
        cityTip: details.cityTip,
        placeDetails: details.placeDetails,
        images: (query, accessKey, observe) => searchUnsplash(query, accessKey, 6, observe),
        places: (destination, observe) =>
            fetchWikivoyageSights(destination, observe, () => quota.reserve("wikipedia.action_api")),
        matchPlace: matchMapboxSight
    };
    const service = createDestinationService(quota, { repository, providers, now: options.now });
    return { router: createDestinationRouter(createDestinationController(service)) };
}
