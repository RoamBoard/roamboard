import { Router } from "express";

import { validate } from "../../middleware/validate.js";
import { createDestinationController } from "./destination.controller.js";
import { destinationContextSchema, destinationSearchSchema } from "./destination.schemas.js";
import type { DestinationService } from "./destination.service.js";

export function createDestinationRouter(service: DestinationService): Router {
  const router = Router();
  const controller = createDestinationController(service);
  router.get("/search", validate(destinationSearchSchema), controller.search);
  router.get("/context", validate(destinationContextSchema), controller.context);
  return router;
}