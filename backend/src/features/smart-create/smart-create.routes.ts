import { Router, type RequestHandler } from "express";
import { requireFrontendOrigin } from "../../middleware/require-origin.js";
import { requireSessionUser } from "../../middleware/session-user.js";
import { validateBody } from "../../middleware/validate.js";
import { smartCreateSchema } from "./smart-create.schemas.js";
export function createSmartCreateRouter(attachUser: RequestHandler, controller: { suggest: RequestHandler }) {
    const router = Router();
    router.post(
        "/images/smart-create",
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        validateBody(smartCreateSchema),
        controller.suggest
    );
    return router;
}
