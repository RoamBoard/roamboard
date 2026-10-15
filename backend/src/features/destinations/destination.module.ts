import type { QuotaService } from "../quotas/quota.service.js";
import { createDestinationService } from "./destination.service.js";
import { createDestinationController } from "./destination.controller.js";
import { createDestinationRouter } from "./destination.routes.js";

export function createDestinationModule(quota: QuotaService) {
    const service = createDestinationService(quota);
    return { router: createDestinationRouter(createDestinationController(service)) };
}
