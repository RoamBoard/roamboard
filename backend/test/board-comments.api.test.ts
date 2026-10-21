import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import request from "supertest";

import { createApp } from "../src/app.js";
import type { AuthRepository, GoogleVerifier } from "../src/features/auth/auth.types.js";
import type { BoardAccess, BoardRepository } from "../src/features/boards/boards.types.js";
import type { CommentRecord, CommentsRepository } from "../src/features/board-comments/board-comments.types.js";

const origin = "http://localhost:3000";
const cookie = (name: string) => `roamboard_session=${name}-token`;

function fakeAuth(): { repository: AuthRepository; googleVerifier: GoogleVerifier } {
    const users = new Map(
        ["owner", "author", "reader", "friend", "member"].map((name) => [
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

function fakeBoards(): { repository: BoardRepository; access: BoardAccess } {
    const access: BoardAccess = {
        boardId: 1,
        ownerUserId: "owner",
        status: "published",
        visibility: "public",
        revision: 1,
        memberRole: null,
        isFriend: false
    };
    const repository = {
        async getAccess(boardId: number, userId: string | null) {
            if (boardId !== 1) return null;
            return {
                ...access,
                memberRole: userId === "member" ? ("viewer" as const) : null,
                isFriend: userId === "friend"
            };
        }
    } as BoardRepository;
    return { repository, access };
}

function fakeComments(): { repository: CommentsRepository; records: CommentRecord[] } {
    const records: CommentRecord[] = [];
    let nextId = 1;
    const repository: CommentsRepository = {
        count: async (boardId) => records.filter((row) => row.boardId === boardId).length,
        async list(boardId, cursor, limit) {
            return records
                .filter((item) => item.boardId === boardId)
                .filter(
                    (item) =>
                        !cursor ||
                        item.createdAt < cursor.createdAt ||
                        (item.createdAt === cursor.createdAt && item.commentId < cursor.commentId)
                )
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.commentId - a.commentId)
                .slice(0, limit);
        },
        async get(boardId, commentId) {
            return records.find((item) => item.boardId === boardId && item.commentId === commentId) ?? null;
        },
        async create(boardId, authorUserId, body) {
            const record: CommentRecord = {
                commentId: nextId++,
                boardId,
                authorUserId,
                body,
                mentions: [],
                author: { displayName: authorUserId, username: authorUserId, profilePictureUrl: null },
                createdAt: "2026-10-19T12:00:00.000Z",
                editedAt: null,
                revision: 1
            };
            records.push(record);
            return record;
        },
        async update(boardId, commentId, authorUserId, revision, body) {
            const record = records.find(
                (item) =>
                    item.boardId === boardId &&
                    item.commentId === commentId &&
                    item.authorUserId === authorUserId &&
                    item.revision === revision
            );
            if (!record) return null;
            record.body = body;
            record.editedAt = "2026-10-19T12:01:00.000Z";
            record.revision++;
            return record;
        },
        async delete(boardId, commentId, userId, ownerUserId) {
            const index = records.findIndex(
                (item) =>
                    item.boardId === boardId &&
                    item.commentId === commentId &&
                    (item.authorUserId === userId || ownerUserId === userId)
            );
            if (index < 0) return false;
            records.splice(index, 1);
            return true;
        }
    };
    return { repository, records };
}

function setup() {
    const boards = fakeBoards();
    const comments = fakeComments();
    const app = createApp({
        ...fakeAuth(),
        boardRepository: boards.repository,
        commentsRepository: comments.repository
    });
    const path = "/api/v1/boards/1/comments";
    return { app, path, ...boards, ...comments };
}

test("public readers see comments without internal IDs, while restricted and draft Boards stay hidden", async () => {
    const { app, path, access } = setup();
    const post = await request(app)
        .post(path)
        .set("Cookie", cookie("author"))
        .set("Origin", origin)
        .send({ body: " Hello\nworld " });
    assert.equal(post.status, 201);
    assert.equal(post.headers.location, `${path}/1`);
    assert.equal(post.body.data.body, "Hello\nworld");
    assert.deepEqual(post.body.data.permissions, { canEdit: true, canDelete: true });
    assert.equal(post.body.data.authorUserId, undefined);
    const publicRead = await request(app).get(path);
    assert.equal(publicRead.status, 200);
    assert.equal(publicRead.headers["cache-control"], "no-store");
    assert.deepEqual(publicRead.body.data[0].permissions, { canEdit: false, canDelete: false });
    assert.equal(publicRead.body.data[0].author.username, "author");

    access.visibility = "friends";
    assert.equal((await request(app).get(path)).status, 404);
    assert.equal((await request(app).get(path).set("Cookie", cookie("reader"))).status, 404);
    assert.equal((await request(app).get(path).set("Cookie", cookie("friend"))).status, 200);
    assert.equal((await request(app).get(path).set("Cookie", cookie("member"))).status, 200);
    access.visibility = "collaborators";
    assert.equal((await request(app).get(path).set("Cookie", cookie("friend"))).status, 404);
    assert.equal((await request(app).get(path).set("Cookie", cookie("member"))).status, 200);
    access.status = "draft";
    assert.equal((await request(app).get(path).set("Cookie", cookie("owner"))).status, 404);
    assert.equal(
        (await request(app).post(path).set("Cookie", cookie("owner")).set("Origin", origin).send({ body: "x" })).status,
        404
    );
});

test("writes require session, exact Origin, a valid trimmed body and known fields", async () => {
    const { app, path } = setup();
    assert.equal((await request(app).post(path).set("Origin", origin).send({ body: "x" })).status, 401);
    assert.equal((await request(app).post(path).set("Cookie", cookie("author")).send({ body: "x" })).status, 403);
    for (const body of [null, "", " \n ", "a".repeat(2001), ["x"]]) {
        const response = await request(app)
            .post(path)
            .set("Cookie", cookie("author"))
            .set("Origin", origin)
            .send({ body });
        assert.equal(response.status, 400);
        assert.equal(response.body.error.code, "INVALID_REQUEST");
    }
    assert.equal(
        (
            await request(app)
                .post(path)
                .set("Cookie", cookie("author"))
                .set("Origin", origin)
                .send({ body: "x", userId: "owner" })
        ).status,
        400
    );
    assert.equal(
        (
            await request(app)
                .post(path)
                .set("Cookie", cookie("author"))
                .set("Origin", origin)
                .send({ body: "🙂".repeat(2000) })
        ).status,
        201
    );
    assert.equal((await request(app).get("/api/v1/boards/2/comments")).status, 404);
    assert.equal((await request(app).get("/api/v1/boards/no/comments")).status, 400);
});

test("comments accept ten distinct handles and reject an eleventh on create or edit", async () => {
    const { app, path, records } = setup();
    const ten = Array.from({ length: 10 }, (_, index) => `@person${index}`).join(" ");
    const eleven = `${ten} @person10`;
    const create = (body: string) =>
        request(app).post(path).set("Cookie", cookie("author")).set("Origin", origin).send({ body });

    const rejected = await create(eleven);
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.error.code, "INVALID_REQUEST");
    assert.equal(records.length, 0);

    const accepted = await create(ten);
    assert.equal(accepted.status, 201);
    const target = `${path}/${accepted.body.data.commentId}`;
    const editRejected = await request(app)
        .patch(target)
        .set("Cookie", cookie("author"))
        .set("Origin", origin)
        .send({ body: eleven, revision: 1 });
    assert.equal(editRejected.status, 400);
    assert.equal(records[0]?.body, ten);
    assert.equal(records[0]?.revision, 1);

    const repeatedHandle = await create(Array.from({ length: 11 }, () => "@Person0").join(" "));
    assert.equal(repeatedHandle.status, 201);
});

test("authors edit with revision checks; owners can remove but cannot edit others' comments", async () => {
    const { app, path } = setup();
    const created = await request(app)
        .post(path)
        .set("Cookie", cookie("author"))
        .set("Origin", origin)
        .send({ body: "one" });
    const target = `${path}/${created.body.data.commentId}`;
    assert.equal(
        (
            await request(app)
                .patch(target)
                .set("Cookie", cookie("owner"))
                .set("Origin", origin)
                .send({ body: "wrong", revision: 1 })
        ).status,
        403
    );
    assert.equal((await request(app).delete(target).set("Cookie", cookie("reader")).set("Origin", origin)).status, 403);
    const ownerView = await request(app).get(path).set("Cookie", cookie("owner"));
    assert.deepEqual(ownerView.body.data[0].permissions, { canEdit: false, canDelete: true });
    const edited = await request(app)
        .patch(target)
        .set("Cookie", cookie("author"))
        .set("Origin", origin)
        .send({ body: " two ", revision: 1 });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.data.body, "two");
    assert.equal(edited.body.data.revision, 2);
    assert.ok(edited.body.data.editedAt);
    const stale = await request(app)
        .patch(target)
        .set("Cookie", cookie("author"))
        .set("Origin", origin)
        .send({ body: "three", revision: 1 });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.code, "STALE_COMMENT");
    assert.equal((await request(app).get(path)).body.data[0].body, "two");
    assert.equal((await request(app).delete(target).set("Cookie", cookie("owner"))).status, 403);
    assert.equal((await request(app).delete(target).set("Cookie", cookie("owner")).set("Origin", origin)).status, 204);
    assert.equal((await request(app).delete(target).set("Cookie", cookie("owner")).set("Origin", origin)).status, 404);
    assert.equal(
        (
            await request(app)
                .patch(`${path}/999`)
                .set("Cookie", cookie("author"))
                .set("Origin", origin)
                .send({ body: "x", revision: 1 })
        ).status,
        404
    );
});

test("cursor pages are newest first, scoped to their Board and reject malformed values", async () => {
    const { app, path } = setup();
    for (let index = 0; index < 22; index++) {
        const result = await request(app)
            .post(path)
            .set("Cookie", cookie("author"))
            .set("Origin", origin)
            .send({ body: `entry ${index}` });
        assert.equal(result.status, 201);
    }
    const first = await request(app).get(path);
    assert.equal(first.body.data.length, 20);
    assert.equal(first.body.data[0].commentId, 22);
    assert.equal(first.body.meta.hasMore, true);
    const second = await request(app).get(path).query({ cursor: first.body.meta.nextCursor });
    assert.equal(second.status, 200);
    assert.deepEqual(
        second.body.data.map((item: { commentId: number }) => item.commentId),
        [2, 1]
    );
    assert.deepEqual(second.body.meta, { nextCursor: null, hasMore: false, totalCount: 22 });
    for (const cursor of [
        "garbage",
        Buffer.from(JSON.stringify([2, "2026-10-19T12:00:00.000Z", 10])).toString("base64url")
    ]) {
        const bad = await request(app).get(path).query({ cursor });
        assert.equal(bad.status, 400);
        assert.equal(bad.body.error.code, "INVALID_REQUEST");
    }
});
