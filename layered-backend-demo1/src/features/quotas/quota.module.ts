import { createQuotaPolicies } from "./quota.policies.js";
import { createMemoryQuotaRepository } from "./quota.repository.js";
import { createQuotaRouter } from "./quota.routes.js";
import { createQuotaService } from "./quota.service.js";
import type { QuotaRepository } from "./quota.types.js";

export function createQuotaModule(repository: QuotaRepository = createMemoryQuotaRepository()) {
  const service = createQuotaService(repository, createQuotaPolicies());
  return { router: createQuotaRouter(service), service };
}
