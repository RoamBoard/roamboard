import { Router } from "express";

import { developmentOnly } from "../../middleware/development-only.js";
import { requireFrontendOrigin } from "../../middleware/require-origin.js";
import { validateBody } from "../../middleware/validate.js";
import type { AuthController } from "./auth.controller.js";
import { createGuestSchema, googleSignInSchema, guestSignInSchema } from "./auth.schemas.js";

export function createAuthRouter(controller: AuthController): Router {
    const router = Router();
    router.post("/google", requireFrontendOrigin, validateBody(googleSignInSchema), controller.signIn);
    router.get("/guests", developmentOnly, controller.listGuests);
    router.post(
        "/guests",
        developmentOnly,
        requireFrontendOrigin,
        validateBody(createGuestSchema),
        controller.createGuest
    );
    router.post(
        "/guests/sign-in",
        developmentOnly,
        requireFrontendOrigin,
        validateBody(guestSignInSchema),
        controller.signInAsGuest
    );
    router.get("/me", controller.me);
    router.post("/logout", requireFrontendOrigin, controller.signOut);
    return router;
}
