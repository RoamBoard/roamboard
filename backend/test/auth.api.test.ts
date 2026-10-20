import assert from "node:assert/strict";
import test from "node:test";

import request from "supertest";

import { createApp } from "../src/app.js";
import type { AppUser, AuthRepository, GoogleVerifier } from "../src/features/auth/auth.types.js";
import { AppError } from "../src/shared/app-error.js";
import { createAuthService } from "../src/features/auth/auth.service.js";
import type { GoogleIdentity } from "../src/features/auth/auth.types.js";
import type { ProviderAsset } from "../src/features/images/images.types.js";

const origin = "http://localhost:3000";
process.env.NODE_ENV = "development";

test("Google sign-in returns a configuration error when its backend client ID is missing", async () => {
    const previous = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    try {
        const response = await request(createApp({ repository: fakeDependencies().repository }))
            .post("/api/v1/auth/google")
            .set("Origin", origin)
            .send({ credential: "credential-must-not-be-verified-without-an-audience" });
        assert.equal(response.status, 503);
        assert.equal(response.body.error.code, "GOOGLE_AUTH_UNAVAILABLE");
    } finally {
        if (previous === undefined) delete process.env.GOOGLE_CLIENT_ID;
        else process.env.GOOGLE_CLIENT_ID = previous;
    }
});

function fakeDependencies(
    initialUsers: AppUser[] = [],
    identity?: GoogleIdentity
): {
    repository: AuthRepository;
    googleVerifier: GoogleVerifier;
    cleanupImages: () => Promise<void>;
} {
    const users = new Map<string, AppUser>(initialUsers.map((user) => [user.userId, user]));
    const sessions = new Map<string, { userId: string; expiresAt: Date }>();

    return {
        async cleanupImages() {},
        repository: {
            async listGuestAccounts() {
                return [...users.values()].filter((user) => user.userId.startsWith("guest:"));
            },
            async createGuestAccount(userId, username) {
                if ([...users.values()].some((user) => user.username === username)) return null;
                const user = { userId, username, displayName: username };
                users.set(userId, user);
                return user;
            },
            async findGuestAccount(userId) {
                return userId.startsWith("guest:") ? (users.get(userId) ?? null) : null;
            },
            async findUserById(id) {
                return users.get(id) ?? null;
            },
            async createUser(user) {
                if (users.has(user.userId) || [...users.values()].some((value) => value.username === user.username))
                    return null;
                users.set(user.userId, user);
                return user;
            },
            async findGooglePhotoStorageKey() {
                return null;
            },
            async saveGoogleDefaults(userId, previousDefaultName, fullName, asset, generatedUsernameBase) {
                const user = users.get(userId);
                if (!user) return;
                users.set(userId, {
                    ...user,
                    ...(generatedUsernameBase && user.username === generatedUsernameBase + "_ab12345678"
                        ? { username: generatedUsernameBase }
                        : {}),
                    displayName: user.displayName === previousDefaultName ? fullName : user.displayName,
                    ...(asset && !user.profilePictureUrl ? { profilePictureUrl: "/api/v1/images/42" } : {})
                });
            },
            async createSession(hash, userId, expiresAt) {
                sessions.set(hash, { userId, expiresAt });
            },
            async findUserBySession(hash) {
                const session = sessions.get(hash);
                return session && session.expiresAt > new Date() ? (users.get(session.userId) ?? null) : null;
            },
            async deleteSession(hash) {
                sessions.delete(hash);
            }
        },
        googleVerifier: {
            async verify(credential) {
                if (credential !== "valid-google-token") {
                    throw new AppError(401, "Invalid Google credential", "INVALID_GOOGLE_CREDENTIAL");
                }
                return (
                    identity ?? {
                        sub: "google-sub-123",
                        givenName: "Ada",
                        familyName: "Lovelace"
                    }
                );
            }
        }
    };
}

test("Google sign-in creates a user and a revocable HTTP-only session cookie", async () => {
    const app = createApp(fakeDependencies());
    const signIn = await request(app)
        .post("/api/v1/auth/google")
        .set("Origin", origin)
        .send({ credential: "valid-google-token" });

    assert.equal(signIn.status, 200);
    assert.equal(signIn.body.data.user.userId, "google-sub-123");
    assert.equal(signIn.body.data.user.displayName, "Ada Lovelace");
    assert.equal(signIn.body.data.isNew, true);
    assert.equal(signIn.body.data.user.username, "ada_lovelace");
    const cookie = signIn.headers["set-cookie"]?.[0] as string;
    assert.match(cookie, /^roamboard_session=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);

    const me = await request(app).get("/api/v1/auth/me").set("Cookie", cookie);
    assert.equal(me.status, 200);
    assert.equal(me.body.data.userId, "google-sub-123");
    assert.equal(me.body.data.displayName, "Ada Lovelace");

    const secondSignIn = await request(app)
        .post("/api/v1/auth/google")
        .set("Origin", origin)
        .send({ credential: "valid-google-token" });
    assert.equal(secondSignIn.body.data.isNew, false);
    assert.equal(secondSignIn.body.data.user.username, signIn.body.data.user.username);

    const signOut = await request(app).post("/api/v1/auth/logout").set("Origin", origin).set("Cookie", cookie);
    assert.equal(signOut.status, 204);
    const afterSignOut = await request(app).get("/api/v1/auth/me").set("Cookie", cookie);
    assert.equal(afterSignOut.status, 401);
});

test("Google sign-in sends its session cookie without waiting for queued image deletions", async () => {
    let cleanups = 0;
    const app = createApp({
        ...fakeDependencies(),
        cleanupImages: async () => {
            cleanups += 1;
            await new Promise<void>(() => {});
        }
    });
    const result = await request(app)
        .post("/api/v1/auth/google")
        .set("Origin", origin)
        .send({ credential: "valid-google-token" })
        .timeout({ deadline: 1000 });
    assert.equal(result.status, 200);
    assert.ok(result.headers["set-cookie"]?.[0]);
    assert.equal(cleanups, 0);
});

test("guest accounts are listed, created once, and can be signed into again", async () => {
    const app = createApp(fakeDependencies());
    const empty = await request(app).get("/api/v1/auth/guests");
    assert.deepEqual(empty.body.data, []);

    const created = await request(app)
        .post("/api/v1/auth/guests")
        .set("Origin", origin)
        .send({ username: "team_demo" });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.isNew, true);
    assert.equal(created.body.data.user.username, "team_demo");
    assert.match(created.body.data.user.userId, /^guest:/);
    const firstCookie = created.headers["set-cookie"]?.[0] as string;
    assert.match(firstCookie, /HttpOnly/);
    assert.equal((await request(app).get("/api/v1/auth/me").set("Cookie", firstCookie)).status, 200);

    const listed = await request(app).get("/api/v1/auth/guests");
    assert.equal(listed.body.data.length, 1);
    assert.equal(listed.body.data[0].userId, created.body.data.user.userId);
    const selected = await request(app)
        .post("/api/v1/auth/guests/sign-in")
        .set("Origin", origin)
        .send({ userId: created.body.data.user.userId });
    assert.equal(selected.status, 200);
    assert.equal(selected.body.data.isNew, false);
    assert.equal(selected.body.data.user.username, "team_demo");
    const selectedCookie = selected.headers["set-cookie"]?.[0] as string;
    assert.equal((await request(app).get("/api/v1/auth/me").set("Cookie", selectedCookie)).status, 200);

    const duplicate = await request(app)
        .post("/api/v1/auth/guests")
        .set("Origin", origin)
        .send({ username: "team_demo" });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.headers["set-cookie"], undefined);
});

test("guest creation and selection validate input and exact frontend origin", async () => {
    const app = createApp(
        fakeDependencies([{ userId: "google-user", username: "google_user", displayName: "Google User" }])
    );
    assert.equal((await request(app).post("/api/v1/auth/guests").send({ username: "demo_one" })).status, 403);
    assert.equal(
        (await request(app).post("/api/v1/auth/guests").set("Origin", origin).send({ username: "bad name" })).status,
        400
    );
    assert.equal(
        (await request(app).post("/api/v1/auth/guests").set("Origin", origin).send({ username: "google_user" })).status,
        409
    );
    assert.equal(
        (await request(app).post("/api/v1/auth/guests/sign-in").set("Origin", origin).send({ userId: "google-user" }))
            .status,
        400
    );
    assert.equal(
        (
            await request(app)
                .post("/api/v1/auth/guests/sign-in")
                .set("Origin", origin)
                .send({ userId: "guest:00000000-0000-0000-0000-000000000000" })
        ).status,
        404
    );
    assert.equal(
        (
            await request(app)
                .post("/api/v1/auth/guests/sign-in")
                .set("Origin", "https://wrong.test")
                .send({ userId: "guest:00000000-0000-0000-0000-000000000000" })
        ).status,
        403
    );
});

test("guest account routes are unavailable in production", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
        const app = createApp(fakeDependencies());
        assert.equal((await request(app).get("/api/v1/auth/guests")).status, 404);
        assert.equal(
            (await request(app).post("/api/v1/auth/guests").set("Origin", origin).send({ username: "demo_user" }))
                .status,
            404
        );
        assert.equal(
            (
                await request(app)
                    .post("/api/v1/auth/guests/sign-in")
                    .set("Origin", origin)
                    .send({ userId: "guest:00000000-0000-0000-0000-000000000000" })
            ).status,
            404
        );
    } finally {
        if (previous === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previous;
    }
});

test("rejects invalid Google credentials, invalid bodies, and foreign origins", async () => {
    const app = createApp(fakeDependencies());
    const invalid = await request(app).post("/api/v1/auth/google").set("Origin", origin).send({ credential: "bad" });
    assert.equal(invalid.status, 401);
    assert.equal(invalid.headers["set-cookie"], undefined);

    const invalidBody = await request(app).post("/api/v1/auth/google").set("Origin", origin).send({ credential: "" });
    assert.equal(invalidBody.status, 400);

    const foreignOrigin = await request(app)
        .post("/api/v1/auth/google")
        .set("Origin", "https://elsewhere.example")
        .send({ credential: "valid-google-token" });
    assert.equal(foreignOrigin.status, 403);

    const anonymous = await request(app).get("/api/v1/auth/me");
    assert.equal(anonymous.status, 401);
});

const googlePhoto: ProviderAsset = {
    storageKey: "roamboard/uploads/google-photo",
    format: "jpg",
    byteSize: 512,
    createdAt: new Date("2026-10-01T12:00:00Z"),
    capturedAt: null,
    latitude: null,
    longitude: null
};

const googleIdentity: GoogleIdentity = {
    sub: "google-sub-123",
    givenName: "Ada",
    familyName: "Lovelace",
    picture: "https://lh3.googleusercontent.com/a/photo"
};

test("Google photo becomes a persisted default returned by sign-in and later sessions", async () => {
    const { repository, googleVerifier } = fakeDependencies([], googleIdentity);
    const imported: string[] = [];
    const service = createAuthService(repository, googleVerifier, async (url) => {
        imported.push(url);
        return googlePhoto;
    });
    const first = await service.signIn("valid-google-token");
    assert.equal(first.user.profilePictureUrl, "/api/v1/images/42");
    assert.equal(first.user.displayName, "Ada Lovelace");
    assert.deepEqual(await service.currentUser(first.sessionToken), first.user);
    const second = await service.signIn("valid-google-token");
    assert.equal(second.user.profilePictureUrl, first.user.profilePictureUrl);
    assert.deepEqual(imported, [googleIdentity.picture]);
});

test("returning Google users get a full name, missing default photo and a readable replacement for their generated handle", async () => {
    const existing = { userId: googleIdentity.sub, username: "ada_lovelace_ab12345678", displayName: "Ada" };
    const { repository, googleVerifier } = fakeDependencies([existing], googleIdentity);
    const service = createAuthService(repository, googleVerifier, async () => googlePhoto);
    const signedIn = await service.signIn("valid-google-token");
    assert.equal(signedIn.isNew, false);
    assert.equal(signedIn.user.username, "ada_lovelace");
    assert.equal(signedIn.user.displayName, "Ada Lovelace");
    assert.equal(signedIn.user.profilePictureUrl, "/api/v1/images/42");
});

test("Google sign-in preserves a customized name and picture without importing another photo", async () => {
    const existing = {
        userId: googleIdentity.sub,
        username: "countess_ada",
        displayName: "Countess Ada",
        profilePictureUrl: "/api/v1/images/7"
    };
    const { repository, googleVerifier } = fakeDependencies([existing], googleIdentity);
    let imports = 0;
    const service = createAuthService(repository, googleVerifier, async () => {
        imports += 1;
        return googlePhoto;
    });
    assert.deepEqual((await service.signIn("valid-google-token")).user, existing);
    assert.equal(imports, 0);
});

test("a failed Google photo import does not block sign-in and is retried on the next login", async () => {
    const { repository, googleVerifier } = fakeDependencies([], googleIdentity);
    let attempts = 0;
    const service = createAuthService(repository, googleVerifier, async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("Photo provider unavailable");
        return googlePhoto;
    });
    const first = await service.signIn("valid-google-token");
    assert.equal(first.user.displayName, "Ada Lovelace");
    assert.equal(first.user.profilePictureUrl, undefined);
    assert.ok(await service.currentUser(first.sessionToken));
    assert.equal((await service.signIn("valid-google-token")).user.profilePictureUrl, "/api/v1/images/42");
    assert.equal(attempts, 2);
});

test("a Google account without a picture signs in without requesting a photo", async () => {
    const { repository, googleVerifier } = fakeDependencies();
    const service = createAuthService(repository, googleVerifier, async () => {
        assert.fail("A missing Google picture must not trigger an import");
    });
    const result = await service.signIn("valid-google-token");
    assert.equal(result.user.profilePictureUrl, undefined);
    assert.equal(result.user.username, "ada_lovelace");
});

test("returning users repair an old imported Google photo on the next login", async () => {
    const existing = {
        userId: googleIdentity.sub,
        username: "ada_lovelace",
        displayName: "Ada Lovelace",
        profilePictureUrl: "/api/v1/images/7"
    };
    const { repository, googleVerifier } = fakeDependencies([existing], googleIdentity);
    repository.findGooglePhotoStorageKey = async () => "roamboard/old-google";
    const saves: unknown[][] = [];
    repository.saveGoogleDefaults = async (...args) => {
        saves.push(args);
    };
    const imports: unknown[][] = [];
    const service = createAuthService(repository, googleVerifier, async (...args) => {
        imports.push(args);
        return googlePhoto;
    });
    await service.signIn("valid-google-token");
    assert.deepEqual(imports, [[googleIdentity.picture, "roamboard/old-google", googleIdentity.sub]]);
    assert.equal(saves[0]?.[5], "roamboard/old-google");
    assert.equal(saves[0]?.[3], googlePhoto);
});
