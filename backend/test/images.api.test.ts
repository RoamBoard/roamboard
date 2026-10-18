import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";

import request from "supertest";

import { createApp } from "../src/app.js";
import type { AuthRepository, GoogleVerifier } from "../src/features/auth/auth.types.js";
import type { BoardAccess, BoardRepository } from "../src/features/boards/boards.types.js";
import { createCloudinaryProvider } from "../src/features/images/images.cloudinary.js";
import { createImagesService } from "../src/features/images/images.service.js";
import type {
    ImageProvider,
    ImagesRepository,
    ProviderAsset,
    UploadedImage,
    UploadIntent
} from "../src/features/images/images.types.js";

const origin = "http://localhost:3000";
const ownerCookie = "roamboard_session=owner-token";
const otherCookie = "roamboard_session=other-token";

function fakeAuth(): { repository: AuthRepository; googleVerifier: GoogleVerifier } {
    const tokens = new Map([
        [createHash("sha256").update("owner-token").digest("hex"), "owner"],
        [createHash("sha256").update("other-token").digest("hex"), "other"]
    ]);
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
            async createSession() {
                /* not used */
            },
            async findUserBySession(hash) {
                const userId = tokens.get(hash);
                return userId ? { userId, username: userId, displayName: userId } : null;
            },
            async deleteSession() {
                /* not used */
            }
        },
        googleVerifier: {
            async verify() {
                throw new Error("not used");
            }
        }
    };
}

function setup() {
    const intents = new Map<string, UploadIntent>();
    const images = new Map<number, UploadedImage>();
    const deleted: string[] = [];
    let ready = false;
    let boardStatus: BoardAccess["status"] = "draft";
    let boardVisibility: BoardAccess["visibility"] = "public";
    let opened = 0;
    const provider: ImageProvider = {
        authorizeUpload(storageKey) {
            return {
                uploadUrl: "https://api.cloudinary.test/image/upload",
                method: "POST",
                headers: {},
                formFields: { public_id: storageKey }
            };
        },
        async inspect(storageKey): Promise<ProviderAsset | null> {
            return ready
                ? {
                      storageKey,
                      format: "jpg",
                      byteSize: 3000,
                      createdAt: new Date(),
                      capturedAt: new Date("2026-05-01T10:00:00Z"),
                      latitude: 35.68,
                      longitude: 139.76
                  }
                : null;
        },
        async openVariant() {
            opened += 1;
            return { stream: Readable.from(Buffer.from("jpeg-data")), contentType: "image/jpeg" };
        },
        async destroy(storageKey) {
            deleted.push(storageKey);
        }
    };
    const imagesRepository: ImagesRepository = {
        async createIntent(intent) {
            intents.set(intent.uploadId, intent);
        },
        async findIntent(uploadId) {
            return intents.get(uploadId) ?? null;
        },
        async completeIntent(intent, asset) {
            const existing = intents.get(intent.uploadId)!;
            if (existing.imageId !== null) return existing.imageId;
            const imageId = 12;
            images.set(imageId, {
                imageId,
                storageKey: asset.storageKey,
                uploaderUserId: intent.userId,
                boardId: null,
                capturedAt: asset.capturedAt,
                latitude: asset.latitude,
                longitude: asset.longitude
            });
            intents.set(intent.uploadId, { ...existing, imageId });
            return imageId;
        },
        async findImage(imageId) {
            return images.get(imageId) ?? null;
        },
        async listCleanupCandidates() {
            return [{ imageId: 12, storageKey: images.get(12)!.storageKey, uploadId: null }];
        },
        async cleanupImage(imageId, removeAsset) {
            if (images.get(imageId)?.boardId !== null) return false;
            await removeAsset();
            return images.delete(imageId);
        },
        async cleanupIntent() {
            return false;
        }
    };
    const boardRepository: BoardRepository = {
        async listAccessible() {
            return { items: [], hasMore: false };
        },
        async listTags() {
            return [];
        },
        async listCategories() {
            return [];
        },
        async getAccess(boardId) {
            return boardId === 1
                ? {
                      boardId,
                      ownerUserId: "owner",
                      status: boardStatus,
                      visibility: boardVisibility,
                      revision: 1,
                      memberRole: null,
                      isFriend: false
                  }
                : null;
        },
        async getBoard() {
            return null;
        },
        async listDrafts() {
            return { items: [], hasMore: false };
        },
        async listPublished() {
            return { items: [], hasMore: false };
        },
        async saveBoard() {
            throw new Error("not used");
        },
        async deleteBoard() {
            return false;
        }
    };
    return {
        app: createApp({ ...fakeAuth(), boardRepository, imagesRepository, imageProvider: provider }),
        images,
        deleted,
        imagesRepository,
        boardRepository,
        provider,
        setReady(value: boolean) {
            ready = value;
        },
        setBoard(status: BoardAccess["status"], visibility: BoardAccess["visibility"]) {
            boardStatus = status;
            boardVisibility = visibility;
        },
        getOpened() {
            return opened;
        }
    };
}

test("photo upload intent, completion, idempotence, ownership and streaming access", async () => {
    const fake = setup();
    const api = request(fake.app);
    assert.equal(
        (
            await api
                .post("/api/v1/images/upload-intents")
                .set("Origin", origin)
                .send({ fileName: "a.jpg", contentType: "image/jpeg", sizeBytes: 3000 })
        ).status,
        401
    );
    assert.equal(
        (
            await api
                .post("/api/v1/images/upload-intents")
                .set("Cookie", ownerCookie)
                .set("Origin", "https://evil.example")
                .send({ fileName: "a.jpg", contentType: "image/jpeg", sizeBytes: 3000 })
        ).status,
        403
    );
    const oversized = await api
        .post("/api/v1/images/upload-intents")
        .set("Cookie", ownerCookie)
        .set("Origin", origin)
        .send({ fileName: "big.heic", contentType: "image/heic", sizeBytes: 10_000_001 });
    assert.equal(oversized.status, 413);
    assert.equal(oversized.body.error.code, "IMAGE_TOO_LARGE");
    assert.equal(
        (
            await api
                .post("/api/v1/images/upload-intents")
                .set("Cookie", ownerCookie)
                .set("Origin", origin)
                .send({ fileName: "a.svg", contentType: "image/svg+xml", sizeBytes: 3000 })
        ).status,
        400
    );

    const intent = await api
        .post("/api/v1/images/upload-intents")
        .set("Cookie", ownerCookie)
        .set("Origin", origin)
        .send({ fileName: "a.heic", contentType: "image/heic", sizeBytes: 3000 });
    assert.equal(intent.status, 200);
    assert.match(intent.body.data.uploadId, /^[0-9a-f-]{36}$/);
    assert.match(intent.body.data.formFields.public_id, /^roamboard\//);
    const uploadId = intent.body.data.uploadId as string;
    assert.equal(
        (await api.post("/api/v1/images/complete").set("Cookie", otherCookie).set("Origin", origin).send({ uploadId }))
            .status,
        404
    );
    assert.equal(
        (await api.post("/api/v1/images/complete").set("Cookie", ownerCookie).set("Origin", origin).send({ uploadId }))
            .status,
        409
    );
    fake.setReady(true);
    const completed = await api
        .post("/api/v1/images/complete")
        .set("Cookie", ownerCookie)
        .set("Origin", origin)
        .send({ uploadId });
    assert.equal(completed.status, 201);
    assert.equal(completed.body.data.imageId, 12);
    assert.equal(completed.body.data.latitude, 35.68);
    assert.equal(completed.body.data.url, "/api/v1/images/12/content?variant=display");
    assert.equal(
        (await api.post("/api/v1/images/complete").set("Cookie", ownerCookie).set("Origin", origin).send({ uploadId }))
            .body.data.imageId,
        12
    );

    assert.equal((await api.get("/api/v1/images/12/content")).status, 404);
    assert.equal((await api.get("/api/v1/images/12/content").set("Cookie", otherCookie)).status, 404);
    const ownerImage = await api.get("/api/v1/images/12/content").set("Cookie", ownerCookie);
    assert.equal(ownerImage.status, 200);
    assert.equal(ownerImage.headers["content-type"], "image/jpeg");
    assert.equal(ownerImage.headers["cache-control"], "private, no-store");
    assert.equal(ownerImage.headers["cross-origin-resource-policy"], "cross-origin");
    assert.equal((ownerImage.body as Buffer).toString(), "jpeg-data");
    assert.equal(fake.getOpened(), 1);
    assert.equal((await api.get("/api/v1/images/12/content?variant=original").set("Cookie", ownerCookie)).status, 400);

    fake.images.get(12)!.profileOwnerUserId = "owner";
    fake.images.get(12)!.profileOwnerUsername = "owner";
    assert.equal((await api.get("/api/v1/images/12/content?profileHandle=owner")).status, 200);
    assert.equal((await api.get("/api/v1/images/12/content?profileHandle=other")).status, 404);
    assert.equal((await api.get("/api/v1/images/12/content?profileHandle=owner&boardId=1")).status, 400);
    fake.images.get(12)!.profileOwnerUserId = null;
    fake.images.get(12)!.profileOwnerUsername = null;
    assert.equal((await api.get("/api/v1/images/12/content?profileHandle=owner")).status, 404);

    fake.images.get(12)!.boardId = 1;
    assert.equal((await api.get("/api/v1/images/12/content")).status, 404);
    assert.equal((await api.get("/api/v1/images/12/content").set("Cookie", otherCookie)).status, 404);
    fake.setBoard("published", "public");
    assert.equal((await api.get("/api/v1/images/12/content")).status, 200);
});

test("cleanup removes only unlinked images", async () => {
    const fake = setup();
    const intent = await request(fake.app)
        .post("/api/v1/images/upload-intents")
        .set("Cookie", ownerCookie)
        .set("Origin", origin)
        .send({ fileName: "a.jpg", contentType: "image/jpeg", sizeBytes: 3000 });
    fake.setReady(true);
    await request(fake.app)
        .post("/api/v1/images/complete")
        .set("Cookie", ownerCookie)
        .set("Origin", origin)
        .send({ uploadId: intent.body.data.uploadId });
    const service = createImagesService(fake.imagesRepository, fake.provider, fake.boardRepository);
    fake.images.get(12)!.boardId = 1;
    assert.equal((await service.cleanupUnused()).removed, 0);
    assert.equal(fake.deleted.length, 0);
    fake.images.get(12)!.boardId = null;
    assert.equal((await service.cleanupUnused()).removed, 1);
    assert.equal(fake.deleted.length, 1);
    assert.equal(fake.images.has(12), false);
});

test("Cloudinary authorization fixes the asset ID, authenticated type and eager variants", () => {
    const previous = {
        cloud: process.env.CLOUDINARY_CLOUD_NAME,
        key: process.env.CLOUDINARY_API_KEY,
        secret: process.env.CLOUDINARY_API_SECRET
    };
    try {
        process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
        process.env.CLOUDINARY_API_KEY = "test-key";
        process.env.CLOUDINARY_API_SECRET = "test-secret";
        const result = createCloudinaryProvider().authorizeUpload("roamboard/fixed-id");
        assert.equal(result.formFields.public_id, "roamboard/fixed-id");
        assert.equal(result.formFields.type, "authenticated");
        assert.equal(result.formFields.overwrite, "false");
        assert.match(result.formFields.eager ?? "", /c_limit,f_jpg,h_1600,q_auto,w_1600/);
        assert.match(result.formFields.eager ?? "", /c_limit,f_jpg,h_320,q_auto,w_320/);
        assert.ok(result.formFields.signature);
    } finally {
        if (previous.cloud === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
        else process.env.CLOUDINARY_CLOUD_NAME = previous.cloud;
        if (previous.key === undefined) delete process.env.CLOUDINARY_API_KEY;
        else process.env.CLOUDINARY_API_KEY = previous.key;
        if (previous.secret === undefined) delete process.env.CLOUDINARY_API_SECRET;
        else process.env.CLOUDINARY_API_SECRET = previous.secret;
    }
});
