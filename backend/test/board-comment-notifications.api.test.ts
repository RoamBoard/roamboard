import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import request from "supertest";

import { createApp } from "../src/app.js";
import type { AuthRepository, GoogleVerifier } from "../src/features/auth/auth.types.js";
import type { BoardAccess, BoardRepository } from "../src/features/boards/boards.types.js";
import type {
    NotificationRecord,
    NotificationsRepository
} from "../src/features/board-comment-notifications/notifications.types.js";

const origin = "http://localhost:3000";
const cookie = (name: string) => `roamboard_session=${name}-token`;

function fakeAuth(): { repository: AuthRepository; googleVerifier: GoogleVerifier } {
    const users = new Map(
        ["owner", "reader", "friend", "member"].map((name) => [
            createHash("sha256").update(`${name}-token`).digest("hex"),
            { userId: name, username: name, displayName: name }
        ])
    );
    return {
        repository: {
            async listGuestAccounts() {
                return [];
            },
            async createGuestAccount() {
                return null;
            },
            async findGuestAccount() {
                return null;
            },
            async findUserById() {
                return null;
            },
            async createUser() {
                return null;
            },
            async findGooglePhotoStorageKey() {
                return null;
            },
            async saveGoogleDefaults() {},
            async createSession() {},
            async findUserBySession(hash) {
                return users.get(hash) ?? null;
            },
            async deleteSession() {}
        },
        googleVerifier: {
            async verify() {
                throw new Error("not used");
            }
        }
    };
}

function setup() {
    const access: BoardAccess = {
        boardId: 1,
        ownerUserId: "owner",
        status: "published",
        visibility: "public",
        revision: 1,
        memberRole: null,
        isFriend: false
    };
    const boards = {
        async getAccess(boardId: number, userId: string | null) {
            if (boardId !== 1) return null;
            return {
                ...access,
                memberRole: userId === "member" ? ("viewer" as const) : null,
                isFriend: userId === "friend"
            };
        }
    } as BoardRepository;
    const preferences = new Map<string, boolean>();
    const records: Array<NotificationRecord & { recipient: string }> = [];
    const notifications: NotificationsRepository = {
        async preference(boardId, userId) {
            return preferences.get(`${boardId}:${userId}`) ?? null;
        },
        async setPreference(boardId, userId, enabled) {
            preferences.set(`${boardId}:${userId}`, enabled);
        },
        async list(userId, cursor, limit) {
            return records
                .filter((item) => item.recipient === userId)
                .filter(
                    (item) =>
                        !cursor ||
                        item.createdAt < cursor.createdAt ||
                        (item.createdAt === cursor.createdAt && item.notificationId < cursor.notificationId)
                )
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.notificationId - a.notificationId)
                .slice(0, limit);
        },
        async unreadCount(userId) {
            return records.filter((item) => item.recipient === userId && item.readAt === null).length;
        },
        async markRead(userId, notificationId) {
            const item = records.find(
                (record) => record.recipient === userId && record.notificationId === notificationId
            );
            if (!item) return null;
            item.readAt ??= "2026-10-19T15:00:00.000Z";
            return { notificationId, readAt: item.readAt };
        }
    };
    const app = createApp({ ...fakeAuth(), boardRepository: boards, notificationsRepository: notifications });
    return { app, access, records };
}

test("subscriptions require access and exact Origin, with owner on and other viewers off by default", async () => {
    const { app, access } = setup();
    const path = "/api/v1/boards/1/comment-subscription";
    assert.equal((await request(app).get(path)).status, 401);
    assert.deepEqual((await request(app).get(path).set("Cookie", cookie("owner"))).body.data, { enabled: true });
    assert.deepEqual((await request(app).get(path).set("Cookie", cookie("reader"))).body.data, { enabled: false });
    assert.equal((await request(app).put(path).set("Cookie", cookie("owner")).send({ enabled: false })).status, 403);
    assert.equal(
        (await request(app).put(path).set("Cookie", cookie("reader")).set("Origin", origin).send({ enabled: "yes" }))
            .status,
        400
    );
    assert.equal(
        (
            await request(app)
                .put(path)
                .set("Cookie", cookie("reader"))
                .set("Origin", origin)
                .send({ enabled: true, userId: "owner" })
        ).status,
        400
    );
    assert.deepEqual(
        (await request(app).put(path).set("Cookie", cookie("reader")).set("Origin", origin).send({ enabled: true }))
            .body.data,
        { enabled: true }
    );
    assert.deepEqual(
        (await request(app).put(path).set("Cookie", cookie("owner")).set("Origin", origin).send({ enabled: false }))
            .body.data,
        { enabled: false }
    );
    access.visibility = "friends";
    assert.equal((await request(app).get(path).set("Cookie", cookie("reader"))).status, 404);
    assert.equal((await request(app).get(path).set("Cookie", cookie("friend"))).status, 200);
    access.visibility = "collaborators";
    assert.equal((await request(app).get(path).set("Cookie", cookie("friend"))).status, 404);
    assert.equal((await request(app).get(path).set("Cookie", cookie("member"))).status, 200);
    access.status = "draft";
    assert.equal((await request(app).get(path).set("Cookie", cookie("owner"))).status, 404);
});

test("notification list paginates, counts unread items and ties cursors to the account", async () => {
    const { app, records } = setup();
    for (let id = 1; id <= 22; id++) {
        records.push({
            notificationId: id,
            recipient: "owner",
            boardId: 1,
            boardTitle: "Tokyo",
            commentId: id,
            body: "A".repeat(200),
            kind: "comment",
            commenter: { displayName: "Reader", username: "reader", profilePictureUrl: null },
            createdAt: "2026-10-19T12:00:00.000Z",
            readAt: null
        });
    }
    const path = "/api/v1/users/me/comment-notifications";
    assert.equal((await request(app).get(path)).status, 401);
    const first = await request(app).get(path).set("Cookie", cookie("owner"));
    assert.equal(first.status, 200);
    assert.equal(first.headers["cache-control"], "no-store");
    assert.equal(first.body.data.length, 20);
    assert.equal(first.body.data[0].notificationId, 22);
    assert.equal(first.body.data[0].kind, "comment");
    assert.equal(first.body.data[0].excerpt.length, 140);
    assert.equal(first.body.data[0].body, undefined);
    assert.equal(first.body.meta.unreadCount, 22);
    const second = await request(app)
        .get(path)
        .set("Cookie", cookie("owner"))
        .query({ cursor: first.body.meta.nextCursor });
    assert.deepEqual(
        second.body.data.map((item: { notificationId: number }) => item.notificationId),
        [2, 1]
    );
    assert.equal(second.body.meta.hasMore, false);
    assert.equal(
        (await request(app).get(path).set("Cookie", cookie("reader")).query({ cursor: first.body.meta.nextCursor }))
            .status,
        400
    );
    assert.equal((await request(app).get(path).set("Cookie", cookie("owner")).query({ cursor: "bad" })).status, 400);
});

test("only the recipient can mark an item read; repeated reads preserve its timestamp", async () => {
    const { app, records } = setup();
    records.push({
        notificationId: 1,
        recipient: "owner",
        boardId: 1,
        boardTitle: "Tokyo",
        commentId: 1,
        body: "Hello",
        kind: "comment",
        commenter: { displayName: "Reader", username: "reader", profilePictureUrl: null },
        createdAt: "2026-10-19T12:00:00.000Z",
        readAt: null
    });
    const path = "/api/v1/users/me/comment-notifications/1/read";
    assert.equal((await request(app).post(path).set("Cookie", cookie("owner"))).status, 403);
    assert.equal((await request(app).post(path).set("Cookie", cookie("reader")).set("Origin", origin)).status, 404);
    const first = await request(app).post(path).set("Cookie", cookie("owner")).set("Origin", origin);
    const second = await request(app).post(path).set("Cookie", cookie("owner")).set("Origin", origin);
    assert.equal(first.status, 200);
    assert.deepEqual(second.body.data, first.body.data);
    assert.equal(
        (await request(app).get("/api/v1/users/me/comment-notifications").set("Cookie", cookie("owner"))).body.meta
            .unreadCount,
        0
    );
});
