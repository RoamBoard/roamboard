import { Router } from "express";

import { validate } from "../../middleware/validate.js";
import type { SearchController } from "./search.controller.js";
import {
  reindexSchema,
  searchSchema,
  suggestionsSchema,
} from "./search.schemas.js";

export function createSearchRouter(controller: SearchController): Router {
  const router = Router();

  router.get("/", validate(searchSchema), controller.search);
  router.get("/suggestions", validate(suggestionsSchema), controller.suggestions);
  router.post("/reindex", validate(reindexSchema), controller.reindex);

  return router;
}