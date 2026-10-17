import { Router, type RequestHandler } from "express";
import { requireSessionUser } from "../../middleware/session-user.js";
import { requireFrontendOrigin } from "../../middleware/require-origin.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import {
    pictureSchema,
    profileChangesSchema,
    publicProfileParamsSchema,
    savedBoardsQuerySchema,
    mapQuerySchema
} from "./users.schemas.js";
import { createUsersController } from "./users.controller.js";
import { boardIdParamsSchema } from "../boards/boards.schemas.js";
import { validateParams } from "../../middleware/validate.js";

export function createUsersRouter(
    controller: ReturnType<typeof createUsersController>,
    attachUser: RequestHandler
): Router {
    const router = Router();
    router.get("/by-handle/:handle", validateParams(publicProfileParamsSchema), attachUser, controller.publicRead);
    router.use(attachUser, requireSessionUser);
    router.get("/me", controller.read);
    router.patch("/me", requireFrontendOrigin, validateBody(profileChangesSchema), controller.update);
    router.put("/me/profile-picture", requireFrontendOrigin, validateBody(pictureSchema), controller.setPicture);
    router.delete("/me/profile-picture", requireFrontendOrigin, controller.deletePicture);
    router.get("/me/boards", controller.boards);
    router.get("/me/recent-boards", controller.recent);
    router.get("/me/stats", controller.stats);
    router.get("/me/map-destinations", validateQuery(mapQuerySchema), controller.destinations);
    router.get("/me/saved-boards", validateQuery(savedBoardsQuerySchema), controller.savedBoards);
    return router;
}

export function createProfileExtrasRouter(
    controller: ReturnType<typeof createUsersController>,
    attachUser: RequestHandler
): Router {
    const router = Router();
    router.get("/languages", controller.languages);
    router.put(
        "/boards/:boardId/save",
        validateParams(boardIdParamsSchema),
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        controller.saveBoard
    );
    router.delete(
        "/boards/:boardId/save",
        validateParams(boardIdParamsSchema),
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        controller.unsaveBoard
    );
    return router;
}
