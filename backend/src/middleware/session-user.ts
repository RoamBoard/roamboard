import type { RequestHandler } from "express";

import { AppError } from "../shared/app-error.js";
import { readSessionCookie } from "../shared/session-cookie.js";
import type { AuthService } from "../features/auth/auth.types.js";

export function attachSessionUser(service: AuthService): RequestHandler {
    return async (request, response, next) => {
        try {
            const token = readSessionCookie(request.headers.cookie);
            response.locals.user = token ? await service.currentUser(token) : null;
            next();
        } catch (error) {
            next(error);
        }
    };
}

export const requireSessionUser: RequestHandler = (_request, response, next) => {
    if (!response.locals.user) {
        next(new AppError(401, "Not signed in", "UNAUTHENTICATED"));
        return;
    }
    next();
};
