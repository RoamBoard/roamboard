import { Router, type RequestHandler } from "express";
import { requireSessionUser } from "../../middleware/session-user.js";
import { requireFrontendOrigin } from "../../middleware/require-origin.js";
import { validateBody } from "../../middleware/validate.js";
import { pictureSchema, profileChangesSchema } from "./users.schemas.js";
import { createUsersController } from "./users.controller.js";

export function createUsersRouter(
    controller: ReturnType<typeof createUsersController>,
    attachUser: RequestHandler
): Router {
    const router = Router();
    router.use(attachUser, requireSessionUser);
    router.get("/me", controller.read);
    router.patch("/me", requireFrontendOrigin, validateBody(profileChangesSchema), controller.update);
    router.put("/me/profile-picture", requireFrontendOrigin, validateBody(pictureSchema), controller.setPicture);
    router.delete("/me/profile-picture", requireFrontendOrigin, controller.deletePicture);
    router.get("/me/boards", controller.boards);
    router.get("/me/recent-boards", controller.recent);
    router.get("/me/stats", controller.stats);
    router.get("/me/map-destinations", controller.destinations);
    return router;
}
