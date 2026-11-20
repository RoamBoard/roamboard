import { Router, type RequestHandler } from "express";

import { AppError } from "../../shared/app-error.js";
import { requireSessionUser } from "../../middleware/session-user.js";
import { requireFrontendOrigin } from "../../middleware/require-origin.js";

export function createAccountDeletionRouter(attachUser: RequestHandler, deleteAccount: RequestHandler): Router {
    const router = Router();
    router.delete(
        "/me",
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        (request, _response, next) => {
            if (request.body !== undefined || Object.keys(request.query).length > 0) {
                next(new AppError(400, "Delete account takes no body or query", "INVALID_REQUEST"));
                return;
            }
            next();
        },
        deleteAccount
    );
    return router;
}
