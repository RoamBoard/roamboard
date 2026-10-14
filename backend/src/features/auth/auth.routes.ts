import { Router } from "express";

import { requireFrontendOrigin } from "../../middleware/require-origin.js";
import { validateBody } from "../../middleware/validate.js";
import type { AuthController } from "./auth.controller.js";
import { googleSignInSchema } from "./auth.schemas.js";

export function createAuthRouter(controller: AuthController): Router {
    const router = Router();
    router.post(
        "/google",
        requireFrontendOrigin,
        validateBody(googleSignInSchema),
        controller.signIn
    );
    router.get("/me", controller.me);
    router.post("/logout", requireFrontendOrigin, controller.signOut);
    return router;
}
