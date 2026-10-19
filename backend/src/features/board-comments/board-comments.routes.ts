import { Router, type RequestHandler } from "express";

import { requireFrontendOrigin } from "../../middleware/require-origin.js";
import { requireSessionUser } from "../../middleware/session-user.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { createCommentsController } from "./board-comments.controller.js";
import {
    commentBoardParamsSchema,
    commentListQuerySchema,
    commentParamsSchema,
    createCommentSchema,
    editCommentSchema
} from "./board-comments.schemas.js";

export function createCommentsRouter(
    controller: ReturnType<typeof createCommentsController>,
    attachUser: RequestHandler
): Router {
    const router = Router();
    router.get(
        "/boards/:boardId/comments",
        validateParams(commentBoardParamsSchema),
        validateQuery(commentListQuerySchema),
        attachUser,
        controller.list
    );
    router.post(
        "/boards/:boardId/comments",
        validateParams(commentBoardParamsSchema),
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        validateBody(createCommentSchema),
        controller.create
    );
    router.patch(
        "/boards/:boardId/comments/:commentId",
        validateParams(commentParamsSchema),
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        validateBody(editCommentSchema),
        controller.edit
    );
    router.delete(
        "/boards/:boardId/comments/:commentId",
        validateParams(commentParamsSchema),
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        controller.delete
    );
    return router;
}
