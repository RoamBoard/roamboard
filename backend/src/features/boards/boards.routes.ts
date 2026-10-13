import { Router, type RequestHandler } from "express";

import { requireFrontendOrigin } from "../../middleware/require-origin.js";
import { requireSessionUser } from "../../middleware/session-user.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { boardIdParamsSchema, createBoardSchema, boardListQuerySchema,
    replaceBoardSchema } from "./boards.schemas.js";
import { createBoardsController } from "./boards.controller.js";

export function createBoardsRouter(
    controller: ReturnType<typeof createBoardsController>,
    attachUser: RequestHandler
): Router {
    const router = Router();
    router.get("/tags", controller.listTags);
    router.get("/activity-categories", controller.listCategories);
    router.get("/boards", attachUser, requireSessionUser,
        validateQuery(boardListQuerySchema), controller.listOwned);
    router.post("/boards", attachUser, requireSessionUser, requireFrontendOrigin,
        validateBody(createBoardSchema), controller.create);
    router.get("/boards/:boardId", validateParams(boardIdParamsSchema), attachUser, controller.read);
    router.put("/boards/:boardId", validateParams(boardIdParamsSchema), attachUser,
        requireSessionUser, requireFrontendOrigin, validateBody(replaceBoardSchema), controller.replace);
    router.delete("/boards/:boardId", validateParams(boardIdParamsSchema), attachUser,
        requireSessionUser, requireFrontendOrigin, controller.delete);
    return router;
}
