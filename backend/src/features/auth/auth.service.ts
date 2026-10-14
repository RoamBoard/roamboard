import { createHash, randomBytes } from "node:crypto";

import { AppError } from "../../shared/app-error.js";
import type { AppUser, AuthRepository, AuthService, GoogleIdentity, GoogleVerifier } from "./auth.types.js";

export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

function usernameBase(identity: GoogleIdentity): string {
    const parts = [identity.givenName, identity.familyName]
        .join("_")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40);
    return parts || "traveler";
}

function displayName(identity: GoogleIdentity): string {
    return identity.givenName.trim().slice(0, 500) || "Traveler";
}

async function findOrCreateUser(
    repository: AuthRepository,
    identity: GoogleIdentity
): Promise<{ user: AppUser; isNew: boolean }> {
    const existing = await repository.findUserById(identity.sub);
    if (existing) return { user: existing, isNew: false };

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const username = `${usernameBase(identity)}_${randomBytes(5).toString("hex")}`;
        const created = await repository.createUser({
            userId: identity.sub,
            username,
            displayName: displayName(identity)
        });
        if (created) return { user: created, isNew: true };

        const concurrent = await repository.findUserById(identity.sub);
        if (concurrent) return { user: concurrent, isNew: false };
    }

    throw new Error("Could not generate a unique username");
}

export function createAuthService(repository: AuthRepository, verifier: GoogleVerifier): AuthService {
    return {
        async signIn(idToken) {
            const identity = await verifier.verify(idToken);
            const { user, isNew } = await findOrCreateUser(repository, identity);
            const sessionToken = randomBytes(32).toString("base64url");
            const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);
            await repository.createSession(hashToken(sessionToken), user.userId, expiresAt);
            return { user, isNew, sessionToken, expiresAt };
        },
        async currentUser(sessionToken) {
            if (!sessionToken || sessionToken.length > 200) return null;
            return repository.findUserBySession(hashToken(sessionToken));
        },
        async signOut(sessionToken) {
            if (!sessionToken || sessionToken.length > 200) {
                throw new AppError(401, "Not signed in", "UNAUTHENTICATED");
            }
            await repository.deleteSession(hashToken(sessionToken));
        }
    };
}
