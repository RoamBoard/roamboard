import { Router, raw, type RequestHandler } from "express";

import { AppError } from "../../shared/app-error.js";
import { requireSessionUser } from "../../middleware/session-user.js";
import { requireFrontendOrigin } from "../../middleware/require-origin.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import { deleteAccountBodySchema, deleteAccountQuerySchema } from "./account-deletion.schemas.js";

export function createAccountDeletionRouter(attachUser: RequestHandler, deleteAccount: RequestHandler): Router {
    const router = Router();
    router.delete(
        "/me",
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        (request, _response, next) => {
            if (
                request.headers["content-type"] !== undefined ||
                request.headers["content-length"] !== undefined ||
                request.headers["transfer-encoding"] !== undefined
            ) {
                next(new AppError(400, "Delete account takes no body", "INVALID_REQUEST"));
                return;
            }
            next();
        },
        raw({ type: () => true, limit: "100kb" }),
        validateBody(deleteAccountBodySchema),
        validateQuery(deleteAccountQuerySchema),
        deleteAccount
    );
    return router;
}
