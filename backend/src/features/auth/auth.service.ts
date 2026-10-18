import { createHash, randomBytes, randomUUID } from "node:crypto";

import { AppError } from "../../shared/app-error.js";
import type {
    AppUser,
    AuthRepository,
    AuthService,
    GoogleIdentity,
    GoogleVerifier,
    GooglePhotoImporter
} from "./auth.types.js";

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
    return (
        [identity.givenName.trim(), identity.familyName.trim()].filter(Boolean).join(" ").slice(0, 500) || "Traveler"
    );
}

async function findOrCreateUser(
    repository: AuthRepository,
    identity: GoogleIdentity
): Promise<{ user: AppUser; isNew: boolean }> {
    const existing = await repository.findUserById(identity.sub);
    if (existing) return { user: existing, isNew: false };

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const username = usernameBase(identity);
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

export function createAuthService(
    repository: AuthRepository,
    verifier: GoogleVerifier,
    importPhoto?: GooglePhotoImporter
): AuthService {
    async function createSession(user: AppUser): Promise<string> {
        const sessionToken = randomBytes(32).toString("base64url");
        await repository.createSession(hashToken(sessionToken), user.userId, new Date(Date.now() + SESSION_MAX_AGE_MS));
        return sessionToken;
    }

    return {
        async listGuestAccounts() {
            return repository.listGuestAccounts();
        },
        async createGuestAccount(username) {
            const user = await repository.createGuestAccount(`guest:${randomUUID()}`, username);
            if (!user) throw new AppError(409, "Username is already taken", "USERNAME_TAKEN");
            return { user, isNew: true, sessionToken: await createSession(user) };
        },
        async signInAsGuest(userId) {
            const user = await repository.findGuestAccount(userId);
            if (!user) throw new AppError(404, "Guest account not found", "GUEST_NOT_FOUND");
            return { user, isNew: false, sessionToken: await createSession(user) };
        },
        async signIn(idToken) {
            const identity = await verifier.verify(idToken);
            const found = await findOrCreateUser(repository, identity);
            let asset;
            const previousPhotoStorageKey =
                identity.picture && found.user.profilePictureUrl
                    ? await repository.findGooglePhotoStorageKey(identity.sub)
                    : null;
            if (identity.picture && (!found.user.profilePictureUrl || previousPhotoStorageKey) && importPhoto) {
                try {
                    asset =
                        (await importPhoto(identity.picture, previousPhotoStorageKey ?? undefined, identity.sub)) ??
                        undefined;
                } catch {
                    // An optional default photo must not prevent Google sign-in. Retry on a later sign-in.
                }
            }
            await repository.saveGoogleDefaults(
                identity.sub,
                identity.givenName.trim(),
                displayName(identity),
                asset,
                usernameBase(identity),
                previousPhotoStorageKey ?? undefined
            );
            const user = (await repository.findUserById(identity.sub)) ?? found.user;
            const isNew = found.isNew;
            const sessionToken = await createSession(user);
            return { user, isNew, sessionToken, expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS) };
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
