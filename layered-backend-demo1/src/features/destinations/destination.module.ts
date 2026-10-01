import { createDestinationRouter } from "./destination.routes.js";
import { createDestinationService } from "./destination.service.js";
import type { QuotaService } from "../quotas/quota.service.js";

export function createDestinationModule(quota: QuotaService) {
  const service = createDestinationService(quota);
  return { router: createDestinationRouter(service), service };
}
