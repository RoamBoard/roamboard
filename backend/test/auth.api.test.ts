import assert from "node:assert/strict";
import test from "node:test";

import request from "supertest";

import { createApp } from "../src/app.js";
import type { AppUser, AuthRepository, GoogleVerifier } from "../src/features/auth/auth.types.js";
import { AppError } from "../src/shared/app-error.js";

const origin = "http://localhost:3000";

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

function fakeDependencies(): {
    repository: AuthRepository;
    googleVerifier: GoogleVerifier;
} {
    const users = new Map<string, AppUser>();
    const sessions = new Map<string, { userId: string; expiresAt: Date }>();

    return {
        repository: {
            async findUserById(id) {
                return users.get(id) ?? null;
            },
            async createUser(user) {
                if (users.has(user.userId) || [...users.values()].some((value) => value.username === user.username))
                    return null;
                users.set(user.userId, user);
                return user;
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
                return {
                    sub: "google-sub-123",
                    givenName: "Ada",
                    familyName: "Lovelace"
                };
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
    assert.equal(signIn.body.data.user.displayName, "Ada");
    assert.equal(signIn.body.data.isNew, true);
    assert.match(signIn.body.data.user.username, /^ada_lovelace_[a-f0-9]{10}$/);
    const cookie = signIn.headers["set-cookie"]?.[0] as string;
    assert.match(cookie, /^roamboard_session=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);

    const me = await request(app).get("/api/v1/auth/me").set("Cookie", cookie);
    assert.equal(me.status, 200);
    assert.equal(me.body.data.userId, "google-sub-123");

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
