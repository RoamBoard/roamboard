import assert from "node:assert/strict";
import test from "node:test";

import request from "supertest";

import { createApp } from "../src/app.js";
import type { AuthRepository } from "../src/features/auth/auth.types.js";
import type { AccountDeletionRepository } from "../src/features/account-deletion/account-deletion.repository.js";
import { AppError } from "../src/shared/app-error.js";
import { sessionCookieName } from "../src/shared/session-cookie.js";

const origin = "http://localhost:3000";
const cookie = `${sessionCookieName()}=test-session`;

function appFor(userId: string | null, deletion: AccountDeletionRepository) {
    let current = userId;
    const repository = {
        async findUserBySession() {
            return current ? { userId: current, username: current, displayName: current } : null;
        }
    } as unknown as AuthRepository;
    return {
        app: createApp({
            repository,
            accountDeletionRepository: {
                async deleteAccount(id) {
                    await deletion.deleteAccount(id);
                    current = null;
                }
            }
        })
    };
}

test("account deletion requires a session and exact Origin and rejects payloads", async () => {
    const calls: string[] = [];
    const { app } = appFor("google-sub", {
        async deleteAccount(id) {
            calls.push(id);
        }
    });
    assert.equal((await request(app).delete("/api/v1/users/me").set("Origin", origin)).status, 401);
    assert.equal((await request(app).delete("/api/v1/users/me").set("Cookie", cookie)).status, 403);
    assert.equal(
        (await request(app).delete("/api/v1/users/me").set("Cookie", cookie).set("Origin", origin).send({})).status,
        400
    );
    for (const [contentType, body] of [
        ["text/plain", "delete"],
        ["application/x-www-form-urlencoded", "delete=true"],
        ["application/octet-stream", Buffer.from("delete")],
        ["application/vnd.roamboard.payload", "delete"]
    ] as const) {
        const response = await request(app)
            .delete("/api/v1/users/me")
            .set("Cookie", cookie)
            .set("Origin", origin)
            .set("Content-Type", contentType)
            .send(body);
        assert.equal(response.status, 400, contentType);
        assert.equal(response.body.error.code, "INVALID_REQUEST", contentType);
    }
    assert.equal(
        (
            await request(app)
                .delete("/api/v1/users/me")
                .set("Cookie", cookie)
                .set("Origin", origin)
                .set("Content-Type", "text/plain")
                .send("")
        ).status,
        400
    );
    assert.equal(
        (await request(app).delete("/api/v1/users/me?userId=another").set("Cookie", cookie).set("Origin", origin))
            .status,
        400
    );
    assert.deepEqual(calls, []);
});

test("confirmed deletion clears cookies, then the old session returns 401", async () => {
    const calls: string[] = [];
    const { app } = appFor("google-sub", {
        async deleteAccount(id) {
            calls.push(id);
        }
    });
    const first = await request(app).delete("/api/v1/users/me").set("Cookie", cookie).set("Origin", origin);
    assert.equal(first.status, 200);
    assert.deepEqual(first.body, { data: { deleted: true } });
    assert.deepEqual(calls, ["google-sub"]);
    assert.ok(String(first.headers["set-cookie"]).includes(`${sessionCookieName()}=`));
    assert.ok(String(first.headers["set-cookie"]).includes("roamboard_browser="));
    const repeated = await request(app).delete("/api/v1/users/me").set("Cookie", cookie).set("Origin", origin);
    assert.equal(repeated.status, 401);
});

test("guest and failed database deletions keep the session", async () => {
    const guest = appFor("guest:one", {
        async deleteAccount() {
            throw new AppError(403, "Account deletion is unavailable for this account", "ACCOUNT_DELETION_UNAVAILABLE");
        }
    }).app;
    const rejected = await request(guest).delete("/api/v1/users/me").set("Cookie", cookie).set("Origin", origin);
    assert.equal(rejected.status, 403);
    assert.equal(rejected.body.error.code, "ACCOUNT_DELETION_UNAVAILABLE");
    assert.equal((await request(guest).get("/api/v1/auth/me").set("Cookie", cookie)).status, 200);

    const failed = appFor("google-sub", {
        async deleteAccount() {
            throw new Error("database unavailable");
        }
    }).app;
    const response = await request(failed).delete("/api/v1/users/me").set("Cookie", cookie).set("Origin", origin);
    assert.equal(response.status, 500);
    assert.equal(response.body.error.code, "INTERNAL_ERROR");
    assert.equal((await request(failed).get("/api/v1/auth/me").set("Cookie", cookie)).status, 200);
});
