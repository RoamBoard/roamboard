import type { RequestHandler } from "express";

import { browserCookieName } from "../board-discovery/discovery.controller.js";
import { sessionCookieName } from "../../shared/session-cookie.js";
import type { AccountDeletionService } from "./account-deletion.service.js";

function cookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/"
    };
}

export function createAccountDeletionController(service: AccountDeletionService): RequestHandler {
    return async (_request, response) => {
        const userId = (response.locals.user as { userId: string }).userId;
        await service.deleteAccount(userId);
        response.clearCookie(sessionCookieName(), cookieOptions());
        response.clearCookie(browserCookieName(), cookieOptions());
        response.json({ data: { deleted: true } });
    };
}
