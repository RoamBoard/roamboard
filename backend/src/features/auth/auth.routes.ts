import { Router, type RequestHandler } from "express";

import { validateBody } from "../../middleware/validate.js";
import { AppError } from "../../shared/app-error.js";
import type { AuthController } from "./auth.controller.js";
import { googleSignInSchema } from "./auth.schemas.js";

function requireFrontendOrigin(): RequestHandler {
    return (request, _response, next) => {
        const expected = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";
        if (request.get("Origin") !== expected) {
            next(new AppError(403, "Origin not allowed", "ORIGIN_NOT_ALLOWED"));
            return;
        }
        next();
    };
}

export function createAuthRouter(controller: AuthController): Router {
    const router = Router();
    const origin = requireFrontendOrigin();
    router.post(
        "/google",
        origin,
        validateBody(googleSignInSchema),
        controller.signIn
    );
    router.get("/me", controller.me);
    router.post("/logout", origin, controller.signOut);
    return router;
}
