import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";
import request from "supertest";
import { v2 as cloudinary } from "cloudinary";
import { createApp } from "../src/app.js";
import { createBoardsService } from "../src/features/boards/boards.service.js";
import type { BoardDocument, BoardRepository } from "../src/features/boards/boards.types.js";
import type { AuthRepository } from "../src/features/auth/auth.types.js";
import { AppError } from "../src/shared/app-error.js";
import { createImagesService } from "../src/features/images/images.service.js";
import { createCloudinaryProvider } from "../src/features/images/images.cloudinary.js";
import type {
    ImageProvider,
    ImagesRepository,
    UploadedImage,
    UploadIntent
} from "../src/features/images/images.types.js";

function source(): BoardDocument {
    return {
        fillerImagesEnabled: false,
        fillerImages: [],
        fillerImageStatus: "disabled",
        commentCount: 0,
        boardId: 91,
        revision: 7,
        status: "published",
        visibility: "friends",
        title: "Paris on foot",
        description: "Two slow days",
        destination: {
            name: "Paris",
            address: null,
            city: "Paris",
            country: "FRA",
            externalPlaceId: "paris",
            latitude: 48.86,
            longitude: 2.33,
            kind: "city"
        },
        author: { username: "original", bio: "Their biography", photo: null },
        savedByMe: true,
        savedCount: 12,
        isCompleted: true,
        permissions: { canEditContent: false, canManageBoard: false },
        tagIds: [1],
        tags: [{ tagId: 1, name: "Food" }],
        imageIds: [20, 30],
        coverImageId: 30,
        images: [20, 30].map((imageId, position) => ({
            imageId,
            position,
            url: `/original/${imageId}`,
            thumbnailUrl: `/original/${imageId}/thumb`,
            largeUrl: `/original/${imageId}/large`,
            capturedAt: null
        })),
        createdAt: "2026-10-01T12:00:00Z",
        updatedAt: "2026-10-02T12:00:00Z",
        days: [1, 2].map((dayNumber) => ({
            dayId: 100 + dayNumber,
            dayNumber,
            date: "2026-10-01",
            color: dayNumber === 1 ? "#c58e76" : null,
            activities: [0, 1].map((position) => ({
                activityId: dayNumber * 1000 + position,
                position,
                title: `Day ${dayNumber}, stop ${position}`,
                activityTime: position ? "15:30" : "09:00",
                note: "Keep these notes",
                category: "museum",
                source: "manual" as const,
                locationConfirmed: true,
                location: {
                    name: "Museum",
                    latitude: 48.86,
                    longitude: 2.33,
                    address: "Rue de Paris",
                    city: "Paris",
                    country: "FRA",
                    externalPlaceId: null
                },
                uploadedImageIds: dayNumber === 1 && position === 0 ? [20, 30] : [],
                coverImageId: dayNumber === 1 && position === 0 ? 30 : null,
                externalImage: null
            }))
        }))
    };
}

function repository(board: BoardDocument | null, readable = true) {
    const calls: string[] = [];
    const value: BoardRepository = {
        getFillerPool: async () => null,
        async listAccessible() {
            return { items: [], hasMore: false };
        },
        async listDrafts() {
            return { items: [], hasMore: false };
        },
        async listPublished() {
            return { items: [], hasMore: false };
        },
        async listTags() {
            return [];
        },
        async listCategories() {
            return [];
        },
        async getAccess() {
            return board
                ? {
                      boardId: board.boardId,
                      ownerUserId: "original",
                      status: board.status,
                      visibility: readable ? "public" : "collaborators",
                      revision: board.revision,
                      memberRole: null,
                      isFriend: false
                  }
                : null;
        },
        async getBoard() {
            return board && readable ? structuredClone(board) : null;
        },
        async saveBoard() {
            calls.push("save");
            throw new Error("Preparation must not persist a Board");
        },
        async deleteBoard() {
            calls.push("delete");
            return false;
        }
    };
    return { value, calls };
}

test("Preparing a saved Board keeps its itinerary and photos without creating a Board or inheriting identity", async () => {
    const board = source();
    const before = structuredClone(board);
    const repo = repository(board);
    const copies: number[] = [];
    const service = createBoardsService(repo.value, async (userId, boardId, imageId) => {
        assert.equal(userId, "new-owner");
        assert.equal(boardId, 91);
        copies.push(imageId);
        return imageId + 100;
    });
    const prepared = await service.prepareRemix("new-owner", 91);
    assert.equal(prepared.title, board.title);
    assert.equal(prepared.description, board.description);
    assert.deepEqual(prepared.destination, board.destination);
    assert.deepEqual(prepared.tags, board.tags);
    assert.deepEqual(copies.sort(), [20, 30]);
    assert.equal(prepared.coverImageId, 130);
    assert.deepEqual(
        prepared.images.map((image) => image.imageId),
        [120, 130]
    );
    assert.deepEqual(
        prepared.days.map((day) => day.dayNumber),
        [1, 2]
    );
    for (const [index, day] of prepared.days.entries()) {
        assert.equal(day.date, null);
        assert.equal(day.color, board.days[index]!.color, "Remixing preserves the chosen day color");
        assert.equal("dayId" in day, false);
        for (const [position, activity] of day.activities.entries()) {
            assert.equal("activityId" in activity, false);
            assert.equal(activity.title, board.days[index]!.activities[position]!.title);
            assert.equal(activity.position, position);
            assert.equal(activity.activityTime, position ? "15:30" : "09:00");
            assert.deepEqual(activity.location, board.days[index]!.activities[position]!.location);
        }
    }
    assert.deepEqual(prepared.days[0]!.activities[0]!.uploadedImageIds, [120, 130]);
    assert.equal(prepared.days[0]!.activities[0]!.coverImageId, 130);
    for (const field of [
        "boardId",
        "revision",
        "author",
        "visibility",
        "isCompleted",
        "savedCount",
        "savedByMe",
        "permissions"
    ]) {
        assert.equal(field in prepared, false, `${field} must follow normal new-Board behavior`);
    }
    assert.deepEqual(repo.calls, []);
    assert.deepEqual(board, before);
});

test("Preparation rejects unsaved, unpublished, missing and newly inaccessible sources before copying photos", async () => {
    const unsaved = { ...source(), savedByMe: false };
    const draft = { ...source(), status: "draft" as const };
    for (const [board, readable] of [
        [unsaved, true],
        [draft, true],
        [null, true],
        [source(), false]
    ] as const) {
        const repo = repository(board, readable);
        const service = createBoardsService(repo.value, async () => {
            assert.fail("Unauthorized sources must not copy photos");
        });
        await assert.rejects(
            service.prepareRemix("new-owner", 91),
            (error: unknown) => error instanceof AppError && error.statusCode === 404
        );
        assert.deepEqual(repo.calls, []);
    }
});

test("Photo-copy failure never creates a partial Board", async () => {
    const repo = repository(source());
    const service = createBoardsService(repo.value, async () => {
        throw new AppError(503, "Copy unavailable", "IMAGE_COPY_UNAVAILABLE");
    });
    await assert.rejects(
        service.prepareRemix("new-owner", 91),
        (error: unknown) => error instanceof AppError && error.statusCode === 503
    );
    assert.deepEqual(repo.calls, []);
    await assert.rejects(
        createBoardsService(repo.value).prepareRemix("new-owner", 91),
        (error: unknown) => error instanceof AppError && error.statusCode === 503
    );
});

test("Saved photos copy the visible crop into independently editable storage without exposing original EXIF", async () => {
    const original: UploadedImage = {
        imageId: 20,
        boardId: 91,
        uploaderUserId: "original",
        storageKey: "roamboard/original-photo",
        capturedAt: new Date("2026-01-02T14:30:00Z"),
        latitude: 48.86,
        longitude: 2.33,
        presentationRevision: 5,
        presentationEdit: { x: 0.1, y: 0.2, width: 0.7, height: 0.6, outputWidth: 700, outputHeight: 600 }
    };
    const untouched = structuredClone(original);
    const images = new Map([[20, original]]);
    const intents: UploadIntent[] = [];
    const imageRepository: ImagesRepository = {
        async createIntent(intent) {
            intents.push(intent);
        },
        async findIntent() {
            return null;
        },
        async findImage(id) {
            return images.get(id) ?? null;
        },
        async completeIntent(intent, asset) {
            images.set(120, {
                imageId: 120,
                boardId: null,
                uploaderUserId: intent.userId,
                storageKey: asset.storageKey,
                capturedAt: asset.capturedAt,
                latitude: asset.latitude,
                longitude: asset.longitude,
                presentationRevision: 0
            });
            return 120;
        },
        async savePresentation(id, userId, revision, edit) {
            const image = images.get(id);
            assert.ok(image);
            assert.equal(image.uploaderUserId, userId);
            assert.equal(image.presentationRevision, revision);
            image.presentationEdit = structuredClone(edit);
            image.presentationRevision = revision + 1;
            return true;
        },
        async listCleanupCandidates() {
            return [];
        },
        async cleanupImage() {
            return false;
        },
        async cleanupIntent() {
            return false;
        }
    };
    const provider: ImageProvider = {
        authorizeUpload() {
            throw new Error("No browser upload is needed");
        },
        async inspect() {
            return null;
        },
        async openVariant() {
            return { stream: Readable.from([]), contentType: "image/jpeg" };
        },
        async destroy() {
            assert.fail("Preparation must retain the original asset");
        },
        async copy(sourceKey, targetKey, edit) {
            assert.equal(sourceKey, original.storageKey);
            assert.deepEqual(edit, original.presentationEdit);
            assert.notEqual(targetKey, sourceKey);
            assert.equal(
                intents[0]?.storageKey,
                targetKey,
                "Track targets before the provider call for abandoned-copy cleanup"
            );
            return {
                storageKey: targetKey,
                format: "jpg",
                byteSize: 3000,
                createdAt: new Date(),
                capturedAt: original.capturedAt,
                latitude: original.latitude,
                longitude: original.longitude
            };
        }
    };
    const service = createImagesService(imageRepository, provider, repository(source()).value);
    assert.equal(await service.copyForBoard("new-owner", 91, 20), 120);
    const copy = images.get(120)!;
    assert.equal(copy.uploaderUserId, "new-owner");
    assert.equal(copy.boardId, null);
    assert.notEqual(copy.storageKey, original.storageKey);
    assert.equal(copy.capturedAt, null);
    assert.equal(copy.latitude, null);
    assert.equal(copy.longitude, null);
    assert.equal(copy.presentationEdit ?? null, null, "The visible source crop is baked into copied pixels");
    const newEdit = { x: 0, y: 0, width: 0.5, height: 1, outputWidth: 300, outputHeight: 600 };
    await service.savePresentation("new-owner", 120, 0, newEdit);
    assert.deepEqual(copy.presentationEdit, newEdit);
    assert.deepEqual(original, untouched);
    await assert.rejects(
        service.savePresentation("new-owner", 20, 5, null),
        (error: unknown) => error instanceof AppError && error.statusCode === 404
    );
    original.boardId = 999;
    await assert.rejects(
        service.copyForBoard("new-owner", 91, 20),
        (error: unknown) => error instanceof AppError && error.statusCode === 404
    );
    assert.equal(intents.length, 1);
});

test("The preparation endpoint requires session and exact Origin, validates IDs, and stages no Board", async () => {
    const board = source();
    board.images = [];
    board.imageIds = [];
    board.coverImageId = null;
    board.days = [];
    const repo = repository(board);
    const auth: AuthRepository = {
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
        async findGooglePhotoStorageKey() {
            return null;
        },
        async createUser() {
            return null;
        },
        async saveGoogleDefaults() {},
        async createSession() {},
        async deleteSession() {},
        async findUserBySession(hash) {
            return hash === createHash("sha256").update("remix-token").digest("hex")
                ? { userId: "new-owner", username: "new-owner", displayName: "New owner" }
                : null;
        }
    };
    const app = createApp({ repository: auth, boardRepository: repo.value });
    const endpoint = "/api/v1/boards/91/remix-content";
    const origin = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";
    await request(app).post(endpoint).set("Origin", origin).expect(401);
    await request(app).post(endpoint).set("Cookie", "roamboard_session=remix-token").expect(403);
    await request(app)
        .post(endpoint)
        .set("Cookie", "roamboard_session=remix-token")
        .set("Origin", "https://untrusted.example")
        .expect(403);
    await request(app)
        .post("/api/v1/boards/invalid/remix-content")
        .set("Cookie", "roamboard_session=remix-token")
        .set("Origin", origin)
        .expect(400);
    const response = await request(app)
        .post(endpoint)
        .set("Cookie", "roamboard_session=remix-token")
        .set("Origin", origin)
        .expect(200);
    assert.equal(response.body.data.title, "Paris on foot");
    assert.equal("boardId" in response.body.data, false);
    assert.deepEqual(repo.calls, []);
});

test("Cloudinary copies only the signed authenticated visible photo into protected storage and safely reports provider failure", async (t) => {
    const keys = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const;
    const previous = keys.map((key) => process.env[key]);
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    t.after(() => {
        keys.forEach((key, index) => {
            if (previous[index] === undefined) delete process.env[key];
            else process.env[key] = previous[index];
        });
    });
    const calls: Array<{ source: string; options: Record<string, unknown> }> = [];
    t.mock.method(cloudinary.uploader, "upload", async (source: string, options: Record<string, unknown>) => {
        calls.push({ source, options });
        if (calls.length > 1) throw new Error("Private provider credentials and internal request details");
        return {
            public_id: "roamboard/new-copy",
            type: "authenticated",
            resource_type: "image",
            format: "jpg",
            bytes: 5000,
            created_at: "2026-10-19T12:00:00Z"
        };
    });
    const provider = createCloudinaryProvider();
    assert.ok(provider.copy);
    const asset = await provider.copy("roamboard/original", "roamboard/new-copy", {
        x: 0.1,
        y: 0.2,
        width: 0.7,
        height: 0.6,
        outputWidth: 700,
        outputHeight: 600
    });
    assert.equal(asset.storageKey, "roamboard/new-copy");
    assert.equal(asset.byteSize, 5000);
    const call = calls[0]!;
    const source = new URL(call.source);
    assert.equal(source.protocol, "https:");
    assert.equal(source.hostname, "res.cloudinary.com");
    assert.match(source.pathname, /^\/test-cloud\/image\/authenticated\/s--[^/]+--\//);
    assert.match(source.pathname, /\/roamboard\/original\.jpg$/);
    assert.match(call.source, /c_crop,h_0\.600000,w_0\.700000,x_0\.100000,y_0\.200000/);
    assert.match(call.source, /c_limit,h_600,w_700/);
    assert.match(call.source, /c_limit[^/]*h_1600[^/]*w_1600/);
    assert.equal(call.options.public_id, "roamboard/new-copy");
    assert.equal(call.options.type, "authenticated");
    assert.equal(call.options.resource_type, "image");
    assert.equal(call.options.overwrite, false);
    assert.deepEqual(call.options.transformation, [{ flags: "force_strip" }]);
    await assert.rejects(provider.copy("roamboard/original", "roamboard/second-copy"), (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 503);
        assert.equal(error.code, "PROVIDER_UNAVAILABLE");
        assert.doesNotMatch(error.message, /credentials|internal request/);
        return true;
    });
    assert.equal(calls.length, 2, "A failed provider copy must not retry automatically");
});
