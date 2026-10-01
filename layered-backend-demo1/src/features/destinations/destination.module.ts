import { createDestinationRouter } from "./destination.routes.js";
import { createDestinationService } from "./destination.service.js";

export function createDestinationModule() {
  const service = createDestinationService();
  return { router: createDestinationRouter(service), service };
}