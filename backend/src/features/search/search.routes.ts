import { Router } from "express";
import { validateQuery } from "../../middleware/validate.js";
import { searchSchema, suggestionSchema } from "./search.schemas.js";
import { createSearchController } from "./search.controller.js";

export function createSearchRouter(controller: ReturnType<typeof createSearchController>): Router {
    const router = Router();
    router.get("/", validateQuery(searchSchema), controller.search);
    router.get("/suggestions", validateQuery(suggestionSchema), controller.suggestions);
    return router;
}
