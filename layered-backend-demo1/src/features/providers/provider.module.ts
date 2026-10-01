import { createProviderRouter } from "./provider.routes.js";
import { createProviderService } from "./provider.service.js";

export function createProviderModule() {
  const service = createProviderService();
  return { router: createProviderRouter(service), service };
}