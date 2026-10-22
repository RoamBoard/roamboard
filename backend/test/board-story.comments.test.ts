import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { createCommentsService } from "../src/features/board-comments/board-comments.service.js";
import type { CommentRecord, CommentsRepository } from "../src/features/board-comments/board-comments.types.js";
import type { BoardAccess, BoardRepository } from "../src/features/boards/boards.types.js";

function fixture() {
    const access: BoardAccess = {
        boardId: 42,
        ownerUserId: "owner",
        status: "published",
        visibility: "public",
        revision: 1,
        memberRole: null,
        isFriend: false
    };
    const boards = {
        async getAccess(boardId: number) {
            return boardId === 42 ? access : null;
        }
    } as unknown as BoardRepository;
    const records: CommentRecord[] = [];
    const reads = { count: 0, list: 0 };
    const repository: CommentsRepository = {
        async count(boardId) {
            reads.count++;
            return records.filter((comment) => comment.boardId === boardId).length;
        },
        async list(boardId, cursor, limit) {
            reads.list++;
            return records
                .filter((comment) => comment.boardId === boardId && (!cursor || comment.commentId < cursor.commentId))
                .sort((a, b) => b.commentId - a.commentId)
                .slice(0, limit);
        },
        async get(boardId, commentId) {
            return records.find((comment) => comment.boardId === boardId && comment.commentId === commentId) ?? null;
        },
        async create(boardId, authorUserId, body) {
            const comment: CommentRecord = {
                boardId,
                commentId: Math.max(0, ...records.map((item) => item.commentId)) + 1,
                authorUserId,
                body,
                mentions: [],
                author: { displayName: "Traveler", username: "traveler", profilePictureUrl: null },
                createdAt: "2026-10-21T10:00:00.000Z",
                editedAt: null,
                revision: 1
            };
            records.push(comment);
            return comment;
        },
        async update(boardId, commentId, authorUserId, revision, body) {
            const comment = records.find(
                (item) => item.boardId === boardId && item.commentId === commentId && item.authorUserId === authorUserId
            );
            if (!comment || comment.revision !== revision) return null;
            comment.body = body;
            comment.revision++;
            return comment;
        },
        async delete(boardId, commentId, userId, ownerUserId) {
            const index = records.findIndex(
                (item) =>
                    item.boardId === boardId &&
                    item.commentId === commentId &&
                    (item.authorUserId === userId || userId === ownerUserId)
            );
            if (index < 0) return false;
            records.splice(index, 1);
            return true;
        }
    };
    const service = createCommentsService(boards, repository);
    return { access, boards, repository, records, reads, service };
}

test("comment HTTP pages expose the full live total on every cursor page without changing the array response", async () => {
    const { boards, repository, service } = fixture();
    for (const index of Array.from({ length: 27 }, (_, index) => index)) {
        await service.create(42, "author", `Comment ${index}`);
    }
    await repository.create(99, "author", "Another Board must not affect the total");
    const app = createApp({ boardRepository: boards, commentsRepository: repository });
    const first = await request(app).get("/api/v1/boards/42/comments");
    assert.equal(first.status, 200);
    assert.equal(first.headers["cache-control"], "no-store");
    assert.equal(first.body.data.length, 20);
    assert.equal(first.body.meta.totalCount, 27);
    assert.equal(first.body.meta.hasMore, true);
    const second = await request(app).get("/api/v1/boards/42/comments").query({ cursor: first.body.meta.nextCursor });
    assert.equal(second.status, 200);
    assert.equal(second.body.data.length, 7);
    assert.deepEqual(second.body.meta, { nextCursor: null, hasMore: false, totalCount: 27 });
});

test("successful deletion changes the authoritative total, editing and denied deletion leave it unchanged", async () => {
    const { service } = fixture();
    assert.equal((await service.list(42, null)).meta.totalCount, 0);
    const comment = await service.create(42, "author", "Before");
    assert.equal((await service.list(42, null)).meta.totalCount, 1);
    await service.edit(42, comment.commentId, "author", "After", 1);
    assert.equal((await service.list(42, null)).meta.totalCount, 1);
    await assert.rejects(service.delete(42, comment.commentId, "stranger"), { statusCode: 403, code: "FORBIDDEN" });
    assert.equal((await service.list(42, null)).meta.totalCount, 1);
    await service.delete(42, comment.commentId, "owner");
    assert.deepEqual(await service.list(42, null), {
        data: [],
        meta: { nextCursor: null, hasMore: false, totalCount: 0 }
    });
});

test("comment totals require published parent access before any count or page reads", async () => {
    const { service, access, reads } = fixture();
    access.visibility = "friends";
    await assert.rejects(service.list(42, null), { statusCode: 404, code: "NOT_FOUND" });
    await assert.rejects(service.list(42, "stranger"), { statusCode: 404, code: "NOT_FOUND" });
    access.status = "draft";
    await assert.rejects(service.list(42, "owner"), { statusCode: 404, code: "NOT_FOUND" });
    await assert.rejects(service.list(99, "owner"), { statusCode: 404, code: "NOT_FOUND" });
    assert.deepEqual(reads, { count: 0, list: 0 });
});
