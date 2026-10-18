import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { AppError } from "../src/shared/app-error.js";
import type {
    LibraryAsset,
    LibraryImage,
    LibraryRepository
} from "../src/features/image-library/image-library.types.js";

const asset: LibraryAsset = {
    provider: "cloudinary",
    url: "https://res.cloudinary.com/test/image/upload/photo.jpg",
    thumbnailUrl: "https://res.cloudinary.com/test/image/upload/photo.jpg",
    alt: "Kyoto",
    credit: "Photographer",
    sourceUrl: "",
    photographerUrl: "",
    cloudinaryAssetId: "asset-one",
    cloudinaryPublicId: "editorial/one",
    unsplashPhotoId: null,
    checksum: "sha256",
    width: 800,
    height: 600
};

test("editorial catalog imports and replacements preserve public reads, development access and revision safety", async () => {
    const previousEnv = process.env.NODE_ENV;
    const previousOrigin = process.env.CLIENT_ORIGIN;
    process.env.NODE_ENV = "development";
    process.env.CLIENT_ORIGIN = "http://localhost:3000";
    const records = new Map<string, LibraryImage>();
    let providerCalls = 0;
    let unavailable = false;
    const repository: LibraryRepository = {
        async list(keys) {
            return [...records.values()].filter((image) => !keys || keys.includes(image.assetKey));
        },
        async find(key) {
            return records.get(key) ?? null;
        },
        async save(key, expectedRevision, image, aliases = [], usages = []) {
            const current = records.get(key);
            if ((current?.revision ?? 0) !== expectedRevision)
                throw new AppError(409, "Conflict", "IMAGE_REVISION_CONFLICT");
            const result = {
                assetKey: key,
                revision: expectedRevision + 1,
                asset: image,
                aliases: current?.aliases ?? aliases,
                usages: current?.usages ?? usages
            };
            records.set(key, result);
            return result;
        }
    };
    const app = createApp({
        repository: {
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
            async deleteSession() {},
            async findUserBySession() {
                return { userId: "developer", username: "developer", displayName: "Developer" };
            }
        },
        libraryRepository: repository,
        libraryProvider: {
            async upload() {
                providerCalls++;
                return asset;
            },
            async unsplash(photoId) {
                providerCalls++;
                if (unavailable) throw new AppError(503, "Provider unavailable", "PROVIDER_UNAVAILABLE");
                return {
                    ...asset,
                    provider: "unsplash",
                    unsplashPhotoId: photoId,
                    cloudinaryAssetId: null,
                    cloudinaryPublicId: null
                };
            }
        }
    });
    const url = "/api/v1/image-library";
    const input = { assetKey: "kyoto.cover", photoId: "photo-id", expectedRevision: 0 };
    const cookie = "roamboard_session=valid";
    try {
        assert.deepEqual((await request(app).get(url).expect(200)).body, { data: [] });
        await request(app).post(`${url}/unsplash`).send(input).expect(401);
        await request(app).post(`${url}/unsplash`).set("Cookie", cookie).send(input).expect(403);
        await request(app)
            .post(`${url}/unsplash`)
            .set("Cookie", cookie)
            .set("Origin", "https://untrusted.test")
            .send(input)
            .expect(403);
        await request(app)
            .post(`${url}/unsplash`)
            .set("Cookie", cookie)
            .set("Origin", process.env.CLIENT_ORIGIN)
            .send({ ...input, photoId: "https://unsafe.test" })
            .expect(400);
        const saved = await request(app)
            .post(`${url}/unsplash`)
            .set("Cookie", cookie)
            .set("Origin", process.env.CLIENT_ORIGIN)
            .send(input)
            .expect(201);
        assert.equal(saved.body.data.revision, 1);
        assert.equal((await request(app).get(`${url}/kyoto.cover`).expect(200)).body.data.assetKey, "kyoto.cover");
        await request(app).get(`${url}/missing`).expect(404);
        assert.equal((await request(app).get(`${url}?keys=kyoto.cover,missing`).expect(200)).body.data.length, 1);
        assert.deepEqual((await request(app).get(`${url}?keys=missing`).expect(200)).body.data, []);
        await request(app).get(`${url}?keys=`).expect(400);
        await request(app)
            .get(`${url}?keys=${Array(51).fill("kyoto.cover").join(",")}`)
            .expect(400);
        await request(app)
            .post(`${url}/unsplash`)
            .set("Cookie", cookie)
            .set("Origin", process.env.CLIENT_ORIGIN)
            .send(input)
            .expect(409);
        assert.equal(providerCalls, 1, "stale writes must not call providers");
        const params = new URLSearchParams({
            assetKey: "kyoto.cover",
            expectedRevision: "1",
            alt: "New photo",
            credit: "Owner",
            sourceUrl: ""
        });
        const replacement = await request(app)
            .post(`${url}/upload?${params}`)
            .set("Cookie", cookie)
            .set("Origin", process.env.CLIENT_ORIGIN)
            .attach("file", Buffer.from("image data"), "photo.jpg")
            .expect(201);
        assert.equal(replacement.body.data.revision, 2);
        unavailable = true;
        await request(app)
            .post(`${url}/unsplash`)
            .set("Cookie", cookie)
            .set("Origin", process.env.CLIENT_ORIGIN)
            .send({ ...input, expectedRevision: 2 })
            .expect(503);
        assert.equal(records.get(input.assetKey)?.revision, 2, "provider failure retains the last working revision");
        assert.equal((await request(app).get(url).expect(200)).body.data[0].asset.cloudinaryAssetId, "asset-one");
        await request(app)
            .post(`${url}/upload?${params}`)
            .set("Cookie", cookie)
            .set("Origin", process.env.CLIENT_ORIGIN)
            .attach("file", Buffer.from("bad"), "photo.svg")
            .expect(400);
        process.env.NODE_ENV = "production";
        await request(app).post(`${url}/unsplash`).send(input).expect(404);
        await request(app).post(`${url}/upload`).expect(404);
        await request(app).get(url).expect(200);
    } finally {
        if (previousEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousEnv;
        if (previousOrigin === undefined) delete process.env.CLIENT_ORIGIN;
        else process.env.CLIENT_ORIGIN = previousOrigin;
    }
});
