import { Router, type RequestHandler } from "express";
import { requireFrontendOrigin } from "../../middleware/require-origin.js";
import { requireSessionUser } from "../../middleware/session-user.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { boardIdParamsSchema } from "../boards/boards.schemas.js";
import type { createDiscoveryController } from "./discovery.controller.js";
import {
    collectionParamsSchema,
    collectionQuerySchema,
    discoveryPageSchema,
    discoverySearchSchema,
    discoverySuggestionsSchema,
    featuredSchema,
    viewSchema
} from "./discovery.schemas.js";

export function createDiscoveryRouter(
    controller: ReturnType<typeof createDiscoveryController>,
    attachUser: RequestHandler
) {
    const router = Router();
    const privateResponse: RequestHandler = (_request, response, next) => {
        response.set("Cache-Control", "private, no-store");
        next();
    };
    const read = [attachUser, privateResponse];
    router.get(
        "/boards/collections/:context",
        ...read,
        validateParams(collectionParamsSchema),
        validateQuery(collectionQuerySchema),
        controller.collection
    );
    router.get(
        "/boards/search/suggestions",
        ...read,
        validateQuery(discoverySuggestionsSchema),
        controller.suggestions
    );
    router.get("/boards/search", ...read, validateQuery(discoverySearchSchema), controller.search);
    router.get("/boards/featured", ...read, validateQuery(featuredSchema), controller.featured);
    router.get("/boards/recent", ...read, validateQuery(discoveryPageSchema), controller.recent);
    router.get("/boards/mine", ...read, requireSessionUser, validateQuery(discoveryPageSchema), controller.mine);
    router.get("/boards/saved", ...read, requireSessionUser, validateQuery(discoveryPageSchema), controller.saved);
    router.post(
        "/boards/:boardId/views",
        ...read,
        requireFrontendOrigin,
        validateParams(boardIdParamsSchema),
        validateBody(viewSchema),
        controller.view
    );
    return router;
}
