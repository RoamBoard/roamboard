import { Router } from "express";
import { validateQuery } from "../../middleware/validate.js";
import { destinationSearchSchema, destinationContextSchema } from "./destination.schemas.js";
import { createDestinationController } from "./destination.controller.js";

export function createDestinationRouter(controller: ReturnType<typeof createDestinationController>): Router {
    const router = Router();
    router.get("/search", validateQuery(destinationSearchSchema.shape.query), controller.search);
    router.get("/context", validateQuery(destinationContextSchema.shape.query), controller.context);
    return router;
}
