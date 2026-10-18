import { Router } from "express";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import { requireFrontendOrigin } from "../../middleware/require-origin.js";
import {
    destinationSearchSchema,
    destinationContextSchema,
    destinationGuideSchema,
    matchPlaceSchema,
    placeDetailsSchema
} from "./destination.schemas.js";
import { createDestinationController } from "./destination.controller.js";

export function createDestinationRouter(controller: ReturnType<typeof createDestinationController>): Router {
    const router = Router();
    router.get("/guide", validateQuery(destinationGuideSchema), controller.guide);
    router.get("/place-details", validateQuery(placeDetailsSchema), controller.placeDetails);
    router.post("/match-place", requireFrontendOrigin, validateBody(matchPlaceSchema), controller.matchPlace);
    router.get("/search", validateQuery(destinationSearchSchema.shape.query), controller.search);
    router.get("/context", validateQuery(destinationContextSchema.shape.query), controller.context);
    return router;
}
