import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import { AppError } from "../src/shared/app-error.js";
import type { BoardAccess, BoardRepository } from "../src/features/boards/boards.types.js";
import { createCloudinaryProvider } from "../src/features/images/images.cloudinary.js";
import { createImagesService } from "../src/features/images/images.service.js";
import type { ImagePresentationEdit } from "../src/features/images/images.schemas.js";
import type { ImageProvider, ImagesRepository, UploadedImage } from "../src/features/images/images.types.js";

const crop: ImagePresentationEdit = {
    x: 0.25,
    y: 0.1,
    width: 0.5,
    height: 0.75,
    outputWidth: 2400,
    outputHeight: 1600
};

function fixture() {
    const image: UploadedImage = {
        imageId: 81,
        boardId: 42,
        uploaderUserId: "photographer",
        storageKey: "roamboard/private-photo",
        presentationEdit: crop,
        capturedAt: null,
        latitude: null,
        longitude: null
    };
    const access: BoardAccess = {
        boardId: 42,
        ownerUserId: "owner",
        status: "published",
        visibility: "public",
        revision: 1,
        memberRole: null,
        isFriend: false
    };
    const repository = {
        async findImage(imageId: number) {
            return imageId === image.imageId ? image : null;
        }
    } as ImagesRepository;
    const boards = {
        async getAccess(boardId: number) {
            return boardId === access.boardId ? access : null;
        }
    } as unknown as BoardRepository;
    const calls: Array<{ variant: string; edit: ImagePresentationEdit | null | undefined }> = [];
    const failures = new Set<string>();
    const provider: ImageProvider = {
        authorizeUpload() {
            throw new Error("No upload is expected");
        },
        async inspect() {
            throw new Error("No metadata inspection is expected");
        },
        async destroy() {
            throw new Error("No provider deletion is expected");
        },
        async openVariant(storageKey, variant, edit) {
            assert.equal(storageKey, image.storageKey);
            calls.push({ variant, edit });
            if (failures.has(variant)) throw new AppError(502, "Provider failed", "IMAGE_DELIVERY_FAILED");
            return { stream: Readable.from(["jpeg"]), contentType: "image/jpeg" };
        }
    };
    return { image, access, calls, failures, service: createImagesService(repository, provider, boards) };
}

test("large images use display access and saved edits while original files stay uploader-only", async () => {
    const { service, access, calls } = fixture();
    const response = await service.openImage(81, "large", null);
    assert.equal(response.contentType, "image/jpeg");
    response.stream.destroy();
    assert.deepEqual(calls, [{ variant: "large", edit: crop }]);
    await assert.rejects(service.openImage(81, "original", null), { statusCode: 404, code: "NOT_FOUND" });
    access.visibility = "friends";
    await assert.rejects(service.openImage(81, "large", null), { statusCode: 404, code: "NOT_FOUND" });
    assert.equal(calls.length, 1, "Unreadable images must never reach provider delivery");
    const owned = await service.openImage(81, "large", "owner");
    owned.stream.destroy();
    assert.deepEqual(calls.at(-1), { variant: "large", edit: crop });
});

test("large profile images preserve current profile linkage and parent Board authorization", async () => {
    const { service, image, access, calls } = fixture();
    image.boardId = null;
    image.profileOwnerUserId = "owner";
    image.profileOwnerUsername = "traveler";
    const scoped = await service.openImage(81, "large", null, 42);
    scoped.stream.destroy();
    const profile = await service.openImage(81, "large", null, undefined, "traveler");
    profile.stream.destroy();
    await assert.rejects(service.openImage(81, "large", null), { statusCode: 404, code: "NOT_FOUND" });
    await assert.rejects(service.openImage(81, "large", null, undefined, "old-handle"), {
        statusCode: 404,
        code: "NOT_FOUND"
    });
    access.visibility = "collaborators";
    await assert.rejects(service.openImage(81, "large", null, 42), { statusCode: 404, code: "NOT_FOUND" });
    image.profileOwnerUserId = "another-owner";
    access.visibility = "public";
    await assert.rejects(service.openImage(81, "large", null, 42), { statusCode: 404, code: "NOT_FOUND" });
    assert.equal(calls.length, 2);
});

test("large delivery failure falls back once to display with the same saved crop", async () => {
    const { service, calls, failures } = fixture();
    failures.add("large");
    const response = await service.openImage(81, "large", null);
    response.stream.destroy();
    assert.deepEqual(calls, [
        { variant: "large", edit: crop },
        { variant: "display", edit: crop }
    ]);
    failures.add("display");
    await assert.rejects(service.openImage(81, "large", null), { statusCode: 502, code: "IMAGE_DELIVERY_FAILED" });
    assert.equal(calls.length, 4, "A failed fallback must stop, without provider retries or original access");
});

test("large Cloudinary delivery limits to 4096 without upscaling and applies saved presentation first", async (context) => {
    const keys = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const;
    const previous = keys.map((key) => process.env[key]);
    context.after(() => {
        keys.forEach((key, index) => {
            if (previous[index] === undefined) delete process.env[key];
            else process.env[key] = previous[index];
        });
    });
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    const urls: string[] = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        urls.push(String(input));
        return new Response("jpeg", { headers: { "content-type": "image/jpeg" } });
    });
    const provider = createCloudinaryProvider();
    const cropped = await provider.openVariant("roamboard/private-photo", "large", crop);
    cropped.stream.destroy();
    const unedited = await provider.openVariant("roamboard/private-photo", "large", null);
    unedited.stream.destroy();
    const url = urls[0]!;
    assert.match(url, /\/image\/authenticated\/s--/);
    const cropIndex = url.indexOf("c_crop,h_0.750000,w_0.500000,x_0.250000,y_0.100000");
    const presentationIndex = url.indexOf("c_limit,h_1600,w_2400");
    const variantIndex = url.indexOf("c_limit,f_jpg,h_4096,q_auto,w_4096");
    assert.ok(cropIndex >= 0 && cropIndex < presentationIndex && presentationIndex < variantIndex, url);
    assert.match(urls[1]!, /c_limit,f_jpg,h_4096,q_auto,w_4096/);
    assert.doesNotMatch(urls[1]!, /c_crop|c_fill|c_scale/);
});
