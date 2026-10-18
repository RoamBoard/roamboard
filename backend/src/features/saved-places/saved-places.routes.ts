import { Router, type RequestHandler } from "express";
import { requireSessionUser } from "../../middleware/session-user.js";
import { requireFrontendOrigin } from "../../middleware/require-origin.js";
import { validateBody, validateParams } from "../../middleware/validate.js";
import { savedPlaceParams, savedPlaceSchema } from "./saved-places.schemas.js";
import type { createSavedPlacesController } from "./saved-places.controller.js";

export function createSavedPlacesRouter(
    controller: ReturnType<typeof createSavedPlacesController>,
    attachUser: RequestHandler
) {
    const router = Router();
    // Account reads require a session; cookie-authenticated writes also check Origin.
    router.use(attachUser, requireSessionUser);
    router.get("/", controller.list);
    router.post("/", requireFrontendOrigin, validateBody(savedPlaceSchema), controller.save);
    router.delete("/:placeId", requireFrontendOrigin, validateParams(savedPlaceParams), controller.remove);
    return router;
}
