import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import request from "supertest";

import { createApp } from "../src/app.js";
import type { AuthRepository, GoogleVerifier } from "../src/features/auth/auth.types.js";
import type { BoardWrite } from "../src/features/boards/boards.schemas.js";
import { canReadBoard } from "../src/features/boards/boards.service.js";
import type { BoardDocument, BoardRepository } from "../src/features/boards/boards.types.js";
import { AppError } from "../src/shared/app-error.js";

const origin = "http://localhost:3000";
const ownerCookie = "roamboard_session=owner-token";
const otherCookie = "roamboard_session=other-token";

function fakeAuth(): { repository: AuthRepository; googleVerifier: GoogleVerifier } {
    const ownerHash = createHash("sha256").update("owner-token").digest("hex");
    const otherHash = createHash("sha256").update("other-token").digest("hex");
    return {
        repository: {
            async findUserById() { return null; },
            async createUser() { return null; },
            async createSession() { /* not used */ },
            async findUserBySession(hash) {
                if (hash === ownerHash) return { userId: "owner", username: "owner", displayName: "Owner" };
                if (hash === otherHash) return { userId: "other", username: "other", displayName: "Other" };
                return null;
            },
            async deleteSession() { /* not used */ }
        },
        googleVerifier: { async verify() { throw new Error("not used"); } }
    };
}

function fakeBoards(memberRole: "editor" | "viewer" | null = null): BoardRepository {
    const boards = new Map<number, BoardDocument>();
    let nextBoardId = 1;
    let nextDayId = 10;
    let nextActivityId = 100;
    return {
        async listTags() { return [{ tagId: 1, name: "Food" }, { tagId: 2, name: "Nature" }]; },
        async listCategories() { return ["museum", "hike"]; },
        async getAccess(boardId, userId) {
            const board = boards.get(boardId);
            return board ? { boardId, ownerUserId: "owner", status: board.status,
                visibility: board.visibility, revision: board.revision,
                memberRole: userId === "other" ? memberRole : null, isFriend: false } : null;
        },
        async getBoard(boardId, userId = undefined) {
            const raw = boards.get(boardId);
            if (!raw) return null;
            const board = structuredClone(raw);
            if (userId !== undefined) {
                const access = await this.getAccess(boardId, userId);
                if (!access || !canReadBoard(access, userId)) return null;
                board.permissions = {
                    canEditContent: access.ownerUserId === userId || (access.status === "published" && access.memberRole === "editor"),
                    canManageBoard: access.ownerUserId === userId
                };
            }
            return board;
        },
        async listDrafts(_userId, page, limit) {
            const items = [...boards.values()].filter((board) => board.status === "draft")
                .slice((page - 1) * limit, page * limit)
                .map((board) => ({ boardId: board.boardId, title: board.title,
                    status: "draft" as const, visibility: board.visibility,
                    coverImageUrl: null, updatedAt: board.updatedAt }));
            return { items, hasMore: false };
        },
        async listPublished(userId, page, limit) {
            const items = userId === "owner"
                ? [...boards.values()].filter((board) => board.status === "published")
                    .slice((page - 1) * limit, page * limit)
                    .map((board) => ({ boardId: board.boardId, title: board.title,
                        status: "published" as const, visibility: board.visibility,
                        coverImageUrl: null, updatedAt: board.updatedAt }))
                : [];
            return { items, hasMore: false };
        },
        async saveBoard(_userId, boardId, revision, input: BoardWrite) {
            const existing = boardId === null ? null : boards.get(boardId);
            if (existing && existing.revision !== revision) {
                throw new AppError(409, "Stale Board", "STALE_BOARD_REVISION");
            }
            const id = boardId ?? nextBoardId++;
            const days = input.days.map((day) => ({
                ...day,
                dayId: day.dayId ?? nextDayId++,
                activities: day.activities.map((activity) => ({
                    ...activity, activityId: activity.activityId ?? nextActivityId++,
                    coverImageId: activity.coverImageId === undefined
                        ? (activity.uploadedImageIds[0] ?? null) : activity.coverImageId
                }))
            }));
            const board: BoardDocument = {
                ...structuredClone(input), days, boardId: id,
                revision: (existing?.revision ?? 0) + 1, isCompleted: false,
                coverImageId: input.coverImageId === undefined
                    ? (input.imageIds[0] ?? null) : input.coverImageId,
                tags: input.tagIds.map((tagId) => ({ tagId, name: tagId === 1 ? "Food" : "Nature" })),
                images: [], createdAt: existing?.createdAt ?? "2026-10-13T00:00:00Z",
                updatedAt: "2026-10-13T00:00:00Z",
                permissions: { canEditContent: false, canManageBoard: false }
            };
            boards.set(id, board);
            return id;
        },
        async deleteBoard(boardId) { return boards.delete(boardId); }
    };
}

const emptyDraft: BoardWrite = {
    status: "draft", title: "", description: null,
    visibility: "collaborators", tagIds: [], imageIds: [], days: []
};

function locatedActivity(confirmed: boolean): BoardWrite["days"][number]["activities"][number] {
    return {
        position: 0, title: "Museum", activityTime: "10:00", category: "museum",
        note: null, source: "photo", location: {
            name: "Museum", latitude: 35.68, longitude: 139.76,
            address: null, city: "Tokyo", country: "Japan", externalPlaceId: null
        }, locationConfirmed: confirmed, uploadedImageIds: [], externalImage: null
    };
}

test("Board HTTP creator flow: draft, validation, revision, publish and read access", async () => {
    const app = createApp({ ...fakeAuth(), boardRepository: fakeBoards("editor") });
    const tags = await request(app).get("/api/v1/tags");
    assert.equal(tags.status, 200);
    assert.equal(tags.body.data[0].name, "Food");
    assert.equal((await request(app).get("/api/v1/activity-categories")).body.data[0], "museum");

    assert.equal((await request(app).post("/api/v1/boards").set("Origin", origin)
        .send(emptyDraft)).status, 401);
    assert.equal((await request(app).post("/api/v1/boards").set("Cookie", ownerCookie)
        .set("Origin", "https://evil.example").send(emptyDraft)).status, 403);
    assert.equal((await request(app).post("/api/v1/boards").set("Cookie", ownerCookie)
        .set("Origin", origin).send({ ...emptyDraft, visibility: "private" })).status, 400);

    const created = await request(app).post("/api/v1/boards").set("Cookie", ownerCookie)
        .set("Origin", origin).send(emptyDraft);
    assert.equal(created.status, 201);
    assert.equal(created.headers.location, "/api/v1/boards/1");
    assert.equal(created.body.data.title, "");
    assert.equal(created.body.data.revision, 1);
    assert.equal((await request(app).get("/api/v1/boards?scope=drafts")
        .set("Cookie", ownerCookie)).body.data.length, 1);
    assert.equal((await request(app).get("/api/v1/boards/1")).status, 404);
    assert.equal((await request(app).get("/api/v1/boards/1")
        .set("Cookie", otherCookie)).status, 404);

    const invalidCategory = { ...emptyDraft, days: [{ dayNumber: 1, date: null,
        activities: [{ ...locatedActivity(false), category: "unknown" }] }], revision: 1 };
    assert.equal((await request(app).put("/api/v1/boards/1").set("Cookie", ownerCookie)
        .set("Origin", origin).send(invalidCategory)).status, 400);
    const invalidOrder = { ...invalidCategory, days: [{ ...invalidCategory.days[0],
        dayNumber: 2, activities: [locatedActivity(false)] }] };
    assert.equal((await request(app).put("/api/v1/boards/1").set("Cookie", ownerCookie)
        .set("Origin", origin).send(invalidOrder)).status, 400);
    const draft = { ...emptyDraft, title: "Tokyo", revision: 1,
        tagIds: [1], days: [{ dayNumber: 1, date: "2026-05-01",
            activities: [locatedActivity(false)] }] };
    const saved = await request(app).put("/api/v1/boards/1").set("Cookie", ownerCookie)
        .set("Origin", origin).send(draft);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.data.revision, 2);
    assert.equal(saved.body.data.days[0].dayId, 10);
    assert.equal(saved.body.data.days[0].activities[0].activityId, 100);
    assert.equal((await request(app).put("/api/v1/boards/1").set("Cookie", ownerCookie)
        .set("Origin", origin).send(draft)).status, 409);

    const publish = { ...draft, revision: 2, status: "published",
        days: [{ ...draft.days[0], dayId: 10,
            activities: [{ ...locatedActivity(false), activityId: 100 }] }] };
    const blocked = await request(app).put("/api/v1/boards/1").set("Cookie", ownerCookie)
        .set("Origin", origin).send(publish);
    assert.equal(blocked.status, 422);
    assert.equal(blocked.body.error.code, "PUBLISH_REQUIREMENTS_NOT_MET");
    const published = await request(app).put("/api/v1/boards/1").set("Cookie", ownerCookie)
        .set("Origin", origin).send({ ...publish, days: [{ ...publish.days[0],
            activities: [{ ...publish.days[0]!.activities[0]!, locationConfirmed: true }] }] });
    assert.equal(published.status, 200);
    assert.equal(published.body.data.status, "published");
    assert.equal(published.body.data.days[0].activities[0].activityId, 100);
    assert.equal((await request(app).get("/api/v1/boards?scope=published")).status, 401);
    const mine = await request(app).get("/api/v1/boards?scope=published")
        .set("Cookie", ownerCookie);
    assert.equal(mine.status, 200);
    assert.equal(mine.body.data[0].boardId, 1);
    assert.equal(mine.body.data[0].status, "published");
    assert.equal((await request(app).get("/api/v1/boards?scope=published")
        .set("Cookie", otherCookie)).body.data.length, 0);
    assert.equal((await request(app).get("/api/v1/boards?scope=drafts")
        .set("Cookie", ownerCookie)).body.data.length, 0);
    assert.equal((await request(app).get("/api/v1/boards/1")).status, 404);
    const publishedWrite = { ...publish, revision: 3, days: [{ ...publish.days[0],
        activities: [{ ...publish.days[0]!.activities[0]!, locationConfirmed: true }] }] };
    assert.equal((await request(app).put("/api/v1/boards/1").set("Cookie", otherCookie)
        .set("Origin", origin).send({ ...publishedWrite, visibility: "public" })).status, 403);
    assert.equal((await request(app).put("/api/v1/boards/1").set("Cookie", otherCookie)
        .set("Origin", origin).send({ ...publishedWrite, status: "draft" })).status, 400);
    const edited = await request(app).put("/api/v1/boards/1").set("Cookie", otherCookie)
        .set("Origin", origin).send({ ...publishedWrite, title: "Edited by collaborator" });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.data.revision, 4);
    assert.equal(edited.body.data.title, "Edited by collaborator");
    assert.equal(edited.body.data.permissions.canManageBoard, false);
    assert.equal((await request(app).put("/api/v1/boards/1").set("Cookie", ownerCookie)
        .set("Origin", origin).send(publishedWrite)).status, 409);
    const ownerEdit = await request(app).put("/api/v1/boards/1").set("Cookie", ownerCookie)
        .set("Origin", origin).send({ ...publishedWrite, revision: 4, visibility: "public" });
    assert.equal(ownerEdit.status, 200);
    assert.equal(ownerEdit.body.data.visibility, "public");
    assert.equal((await request(app).delete("/api/v1/boards/1").set("Cookie", otherCookie)
        .set("Origin", origin)).status, 403);
    assert.equal((await request(app).delete("/api/v1/boards/1").set("Cookie", ownerCookie)
        .set("Origin", origin)).status, 204);
    assert.equal((await request(app).get("/api/v1/boards/1").set("Cookie", ownerCookie)).status, 404);
});

test("rejects duplicate tags, images, positions and unconfirmed manual locations", async () => {
    const app = createApp({ ...fakeAuth(), boardRepository: fakeBoards() });
    const cases: BoardWrite[] = [
        { ...emptyDraft, tagIds: [1, 1] },
        { ...emptyDraft, imageIds: [1, 1] },
        { ...emptyDraft, imageIds: [1], coverImageId: 2 },
        { ...emptyDraft, imageIds: [1, 2], days: [{ dayNumber: 1, date: null,
            activities: [{ ...locatedActivity(false), uploadedImageIds: [1], coverImageId: 2 }] }] },
        { ...emptyDraft, days: [{ dayNumber: 1, date: null,
            activities: [{ ...locatedActivity(false), source: "manual" }] }] },
        { ...emptyDraft, days: [{ dayNumber: 1, date: null,
            activities: [{ ...locatedActivity(false), position: 1 }] }] }
    ];
    for (const body of cases) {
        const result = await request(app).post("/api/v1/boards")
            .set("Cookie", ownerCookie).set("Origin", origin).send(body);
        assert.equal(result.status, 400);
    }
});

test("a Board viewer cannot edit published content", async () => {
    const app = createApp({ ...fakeAuth(), boardRepository: fakeBoards("viewer") });
    const publishedBoard: BoardWrite = {
        ...emptyDraft, status: "published", title: "Tokyo",
        days: [{ dayNumber: 1, date: null, activities: [locatedActivity(true)] }]
    };
    const created = await request(app).post("/api/v1/boards")
        .set("Cookie", ownerCookie).set("Origin", origin).send(publishedBoard);
    assert.equal(created.status, 201);
    assert.equal((await request(app).get("/api/v1/boards/1")
        .set("Cookie", otherCookie)).status, 200);
    const blocked = await request(app).put("/api/v1/boards/1")
        .set("Cookie", otherCookie).set("Origin", origin)
        .send({ ...publishedBoard, revision: 1, title: "Unauthorized edit" });
    assert.equal(blocked.status, 403);
    assert.equal((await request(app).get("/api/v1/boards/1")
        .set("Cookie", ownerCookie)).body.data.title, "Tokyo");
});

test("Board visibility permits only the intended audience", () => {
    const base = { boardId: 1, ownerUserId: "owner", status: "draft" as const,
        visibility: "public" as const, revision: 1,
        memberRole: "editor" as const, isFriend: true };
    assert.equal(canReadBoard(base, "owner"), true);
    assert.equal(canReadBoard(base, "other"), false);
    assert.equal(canReadBoard(base, null), false);

    const published = { ...base, status: "published" as const };
    assert.equal(canReadBoard(published, null), true);
    assert.equal(canReadBoard({ ...published, visibility: "friends", memberRole: null }, null), false);
    assert.equal(canReadBoard({ ...published, visibility: "friends", memberRole: null }, "other"), true);
    assert.equal(canReadBoard({ ...published, visibility: "friends", memberRole: null,
        isFriend: false }, "other"), false);
    assert.equal(canReadBoard({ ...published, visibility: "collaborators", isFriend: false },
        "other"), true);
    assert.equal(canReadBoard({ ...published, visibility: "collaborators" }, null), false);
    assert.equal(canReadBoard({ ...published, visibility: "collaborators", memberRole: null },
        "other"), false);
});
