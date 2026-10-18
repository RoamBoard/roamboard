import { Router, type RequestHandler } from "express";
import { requireFrontendOrigin } from "../../middleware/require-origin.js";
import { requireSessionUser } from "../../middleware/session-user.js";
import { imageIdParamsSchema } from "../boards/boards.schemas.js";
import { validateBody, validateParams } from "../../middleware/validate.js";
import { smartCreateSchema } from "./smart-create.schemas.js";
export function createSmartCreateRouter(
    attachUser: RequestHandler,
    controller: { suggest: RequestHandler; refresh: RequestHandler }
) {
    const router = Router();
    router.post(
        "/images/smart-create",
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        validateBody(smartCreateSchema),
        controller.suggest
    );
    router.post(
        "/images/:imageId/refresh-location",
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        validateParams(imageIdParamsSchema),
        controller.refresh
    );
    return router;
}
