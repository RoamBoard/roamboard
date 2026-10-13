import type { RequestHandler } from "express";

import { AppError } from "../../shared/app-error.js";
import { SESSION_MAX_AGE_MS } from "./auth.service.js";
import type { AuthService } from "./auth.types.js";

function cookieName(): string {
    return process.env.NODE_ENV === "production"
        ? "__Host-roamboard_session"
        : "roamboard_session";
}

function cookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/"
    };
}

function readSessionCookie(header: string | undefined): string | null {
    const name = `${cookieName()}=`;
    const entry = header
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(name));
    return entry ? entry.slice(name.length) : null;
}

export interface AuthController {
    signIn: RequestHandler;
    me: RequestHandler;
    signOut: RequestHandler;
}

export function createAuthController(service: AuthService): AuthController {
    const signIn: RequestHandler = async (request, response) => {
        const { credential } = request.body as { credential: string };
        const result = await service.signIn(credential);
        response.cookie(cookieName(), result.sessionToken, {
            ...cookieOptions(),
            maxAge: SESSION_MAX_AGE_MS
        });
        response
            .status(200)
            .json({ data: { user: result.user, isNew: result.isNew } });
    };

    const me: RequestHandler = async (request, response) => {
        const token = readSessionCookie(request.headers.cookie);
        const user = token ? await service.currentUser(token) : null;
        if (!user) throw new AppError(401, "Not signed in", "UNAUTHENTICATED");
        response.json({ data: user });
    };

    const signOut: RequestHandler = async (request, response) => {
        const token = readSessionCookie(request.headers.cookie);
        if (token) await service.signOut(token);
        response.clearCookie(cookieName(), cookieOptions());
        response.status(204).send();
    };

    return { signIn, me, signOut };
}
