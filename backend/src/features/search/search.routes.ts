import { Router, type RequestHandler } from "express";
import { validateQuery } from "../../middleware/validate.js";
import { requireFrontendOrigin } from "../../middleware/require-origin.js";
import { requireSessionUser } from "../../middleware/session-user.js";
import { developmentOnly } from "../../middleware/development-only.js";
import { searchSchema, suggestionSchema } from "./search.schemas.js";
import { createSearchController } from "./search.controller.js";

export function createSearchRouter(
    controller: ReturnType<typeof createSearchController>,
    attachUser: RequestHandler
): Router {
    const router = Router();
    router.get("/", validateQuery(searchSchema), controller.search);
    router.get("/suggestions", validateQuery(suggestionSchema), controller.suggestions);
    router.post("/reindex", developmentOnly, attachUser, requireSessionUser, requireFrontendOrigin, controller.reindex);
    return router;
}
