import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import request from "supertest";
import { createApp, type AppOptions } from "../src/app.js";
import type { AuthRepository } from "../src/features/auth/auth.types.js";
import type { ImagesRepository, UploadedImage } from "../src/features/images/images.types.js";
import type { MapboxLocation } from "../src/features/providers/provider.types.js";
import { cloudinaryPhotoMetadata } from "../src/features/images/photo-metadata.js";
import type { BoardDocument, BoardRepository } from "../src/features/boards/boards.types.js";
import type { ProviderQuotaSignal } from "../src/features/quotas/quota.types.js";

const origin = "http://localhost:3000";
const cookie = "roamboard_session=smart-create-owner";
const location: MapboxLocation = {
    id: "geoapify-tower",
    label: "Eiffel Tower",
    detail: "Champ de Mars, Paris",
    type: "landmark",
    latitude: 48.8584,
    longitude: 2.2945,
    country: "France",
    countryCode: "FRA",
    city: "Paris"
};

function photo(imageId: number, overrides: Partial<UploadedImage> = {}): UploadedImage {
    return {
        imageId,
        storageKey: `roamboard/private/${imageId}`,
        uploaderUserId: "owner",
        boardId: null,
        capturedAt: new Date("2026-06-21T09:00:00Z"),
        latitude: 48.8584,
        longitude: 2.2945,
        ...overrides
    };
}

function setup(
    records: UploadedImage[],
    resolver?: AppOptions["smartCreateResolver"],
    boardRepository?: BoardRepository,
    quotaService?: AppOptions["quotaService"]
) {
    const calls: Array<[number, number]> = [];
    const auth: AuthRepository = {
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
            return hash === createHash("sha256").update("smart-create-owner").digest("hex")
                ? { userId: "owner", username: "owner", displayName: "Owner" }
                : null;
        },
        async deleteSession() {}
    };
    const imagesRepository: ImagesRepository = {
        async createIntent() {},
        async findIntent() {
            return null;
        },
        async completeIntent() {
            throw new Error("Not used");
        },
        async findImage(imageId) {
            return records.find((image) => image.imageId === imageId) ?? null;
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
    const app = createApp({
        repository: auth,
        imagesRepository,
        boardRepository,
        quotaService,
        smartCreateResolver: quotaService
            ? undefined
            : async (latitude, longitude) => {
                  calls.push([latitude, longitude]);
                  return resolver ? resolver(latitude, longitude) : location;
              }
    });
    return { api: request(app), calls };
}

test("Smart Create requires an authenticated session and exact frontend origin", async () => {
    const { api, calls } = setup([photo(1)]);
    assert.equal(
        (
            await api
                .post("/api/v1/images/smart-create")
                .set("Origin", origin)
                .send({ imageIds: [1] })
        ).status,
        401
    );
    assert.equal(
        (
            await api
                .post("/api/v1/images/smart-create")
                .set("Cookie", cookie)
                .set("Origin", "https://untrusted.example")
                .send({ imageIds: [1] })
        ).status,
        403
    );
    assert.equal(
        (
            await api
                .post("/api/v1/images/smart-create")
                .set("Cookie", cookie)
                .send({ imageIds: [1] })
        ).status,
        403
    );
    assert.deepEqual(calls, []);
});

test("the default Geoapify path finds named restaurants and landmarks and observes each quota-managed request", async (context) => {
    const previousKey = process.env.GEOAPIFY_API_KEY;
    process.env.GEOAPIFY_API_KEY = "test-smart-create-key";
    context.after(() => {
        if (previousKey === undefined) delete process.env.GEOAPIFY_API_KEY;
        else process.env.GEOAPIFY_API_KEY = previousKey;
    });
    const urls: URL[] = [];
    const policies: string[] = [];
    const observations: ProviderQuotaSignal[] = [];
    const quotaService: NonNullable<AppOptions["quotaService"]> = {
        async reserve() {},
        async run(policyId, operation) {
            policies.push(policyId);
            return operation(async (signal) => {
                observations.push(signal);
            });
        }
    };
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        const url = new URL(String(input));
        urls.push(url);
        const restaurant = urls.length === 1;
        return Response.json({
            features: [
                {
                    properties: {
                        place_id: restaurant ? "restaurant-id" : "landmark-id",
                        name: restaurant ? "Le Petit Restaurant" : "Eiffel Tower",
                        categories: [restaurant ? "catering.restaurant" : "tourism.sights.tower"],
                        lat: 48.8584,
                        lon: 2.2945,
                        city: "Paris",
                        country: "France",
                        country_code: "fr",
                        formatted: "Champ de Mars, Paris"
                    }
                }
            ]
        });
    });
    for (const expected of [
        { label: "Le Petit Restaurant", category: "restaurant" },
        { label: "Eiffel Tower", category: "landmark" }
    ]) {
        const { api } = setup([photo(1)], undefined, undefined, quotaService);
        const response = await api
            .post("/api/v1/images/smart-create")
            .set("Cookie", cookie)
            .set("Origin", origin)
            .send({ imageIds: [1] });
        assert.equal(response.status, 200);
        assert.equal(response.body.data.photos[0].location.label, expected.label);
        assert.equal(response.body.data.photos[0].location.countryCode, "FRA");
        assert.equal(response.body.data.photos[0].category, expected.category);
        assert.doesNotMatch(JSON.stringify(response.body), /test-smart-create-key/);
    }
    for (const url of urls) {
        assert.equal(url.origin, "https://api.geoapify.com");
        assert.equal(url.pathname, "/v2/places");
        assert.equal(url.searchParams.get("filter"), "circle:2.2945,48.8584,75");
        assert.equal(url.searchParams.get("bias"), "proximity:2.2945,48.8584");
        assert.match(url.searchParams.get("categories") ?? "", /catering/);
    }
    assert.deepEqual(policies, ["geoapify.geocoding", "geoapify.geocoding"]);
    assert.deepEqual(
        observations.map((signal) => signal.status),
        [200, 200]
    );
});

test("the default Geoapify path falls back from an unnamed nearby result to a reverse-geocoded address", async (context) => {
    const previousKey = process.env.GEOAPIFY_API_KEY;
    process.env.GEOAPIFY_API_KEY = "test-smart-create-key";
    context.after(() => {
        if (previousKey === undefined) delete process.env.GEOAPIFY_API_KEY;
        else process.env.GEOAPIFY_API_KEY = previousKey;
    });
    const urls: URL[] = [];
    const policies: string[] = [];
    const observations: ProviderQuotaSignal[] = [];
    const quotaService: NonNullable<AppOptions["quotaService"]> = {
        async reserve() {},
        async run(policyId, operation) {
            policies.push(policyId);
            return operation(async (signal) => {
                observations.push(signal);
            });
        }
    };
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        const url = new URL(String(input));
        urls.push(url);
        return Response.json({
            features: [
                {
                    properties: {
                        place_id: "address-id",
                        result_type: "building",
                        address_line1: "5 Avenue Anatole France",
                        lat: 48.8584,
                        lon: 2.2945,
                        city: "Paris",
                        country: "France",
                        country_code: "fr",
                        formatted: "5 Avenue Anatole France, Paris, France"
                    }
                }
            ]
        });
    });
    const { api } = setup([photo(1)], undefined, undefined, quotaService);
    const response = await api
        .post("/api/v1/images/smart-create")
        .set("Cookie", cookie)
        .set("Origin", origin)
        .send({ imageIds: [1] });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.photos[0].location.label, "5 Avenue Anatole France, Paris, France");
    assert.equal(response.body.data.photos[0].category, "address");
    assert.deepEqual(
        urls.map((url) => url.pathname),
        ["/v2/places", "/v1/geocode/reverse"]
    );
    assert.equal(urls[1]?.searchParams.get("lat"), "48.8584");
    assert.equal(urls[1]?.searchParams.get("lon"), "2.2945");
    assert.deepEqual(policies, ["geoapify.geocoding", "geoapify.geocoding"]);
    assert.deepEqual(
        observations.map((signal) => signal.status),
        [200, 200]
    );
});

test("Cloudinary EXIF uses camera wall time and supports decimal, DMS, fractional and nested GPS", () => {
    const samples = [
        {
            image_metadata: {
                DateTimeOriginal: "2026:06:21 00:15:30",
                GPSLatitude: "48 deg 51' 30.24\" N",
                GPSLongitude: "2 deg 17' 40.20\" E"
            }
        },
        {
            exif: {
                DateTimeOriginal: "2026-06-21T00:15:30+09:00",
                GPSLatitude: ["48/1", "51/1", "3024/100"],
                GPSLongitude: [2, 17, "4020/100"],
                GPSLatitudeRef: "N",
                GPSLongitudeRef: "E"
            }
        },
        {
            media_metadata: {
                DateTimeOriginal: "2026-06-21T00:15:30-07:00",
                GPS: { Latitude: 48.8584, Longitude: 2.2945 }
            }
        }
    ];
    for (const sample of samples) {
        const metadata = cloudinaryPhotoMetadata(sample);
        assert.equal(metadata.capturedAt?.toISOString(), "2026-06-21T00:15:30.000Z");
        assert.ok(Math.abs((metadata.latitude ?? 0) - 48.8584) < 0.00001);
        assert.ok(Math.abs((metadata.longitude ?? 0) - 2.2945) < 0.00001);
    }
    const southern = cloudinaryPhotoMetadata({
        image_metadata: { GPSLatitude: [33, 51, 31.2], GPSLatitudeRef: "S", GPSLongitude: "151 12 50.4 W" }
    });
    assert.ok((southern.latitude ?? 0) < 0);
    assert.ok((southern.longitude ?? 0) < 0);
});

test("missing or malformed EXIF never invents dates or valid GPS coordinates", () => {
    assert.deepEqual(cloudinaryPhotoMetadata({ created_at: "2026-06-21T09:00:00Z" }), {
        capturedAt: null,
        latitude: null,
        longitude: null
    });
    for (const DateTimeOriginal of ["2026:02:30 12:00:00", "2026:06:21 25:00:00", "not a date"]) {
        assert.equal(cloudinaryPhotoMetadata({ image_metadata: { DateTimeOriginal } }).capturedAt, null);
    }
    for (const GPSLatitude of [91, "48 60 0", ["1/0", 0, 0]]) {
        assert.equal(cloudinaryPhotoMetadata({ image_metadata: { GPSLatitude } }).latitude, null);
    }
    assert.equal(cloudinaryPhotoMetadata({ image_metadata: { GPSLongitude: 181 } }).longitude, null);
});

test("the Board API accepts photos from repeated batches and enforces the 31-day limit", async () => {
    const saved: BoardDocument[] = [];
    const boardRepository: BoardRepository = {
        async listAccessible() {
            return { items: [], hasMore: false };
        },
        async listTags() {
            return [];
        },
        async listCategories() {
            return ["landmark"];
        },
        async getAccess() {
            return null;
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
        async deleteBoard() {
            return false;
        },
        async saveBoard(_userId, _boardId, _revision, input) {
            const document: BoardDocument = {
                ...input,
                boardId: 1,
                revision: 1,
                isCompleted: false,
                coverImageId: 1,
                author: { username: "owner", bio: "", photo: null },
                savedByMe: false,
                tags: [],
                images: [],
                createdAt: "2026-06-21T09:00:00Z",
                updatedAt: "2026-06-21T09:00:00Z",
                permissions: { canEditContent: true, canManageBoard: true }
            };
            saved.push(document);
            return document;
        }
    };
    const { api } = setup([], undefined, boardRepository);
    const imageIds = Array.from({ length: 31 }, (_, index) => index + 1);
    const activity = {
        position: 0,
        title: "Eiffel Tower",
        activityTime: "09:00",
        category: "landmark",
        note: null,
        source: "photo",
        location: null,
        locationConfirmed: false,
        uploadedImageIds: imageIds,
        coverImageId: 1,
        externalImage: null
    };
    const body = {
        status: "draft",
        title: "Trip",
        description: null,
        visibility: "collaborators",
        tagIds: [],
        imageIds,
        coverImageId: 1,
        days: Array.from({ length: 31 }, (_, index) => ({
            dayNumber: index + 1,
            date: null,
            activities: index === 0 ? [activity] : []
        }))
    };
    const response = await api.post("/api/v1/boards").set("Cookie", cookie).set("Origin", origin).send(body);
    assert.equal(response.status, 201);
    assert.equal(saved[0]?.imageIds.length, 31);
    assert.equal(saved[0]?.days[0]?.activities[0]?.uploadedImageIds.length, 31);
    assert.equal(saved[0]?.days.length, 31);
    const invalid = await api
        .post("/api/v1/boards")
        .set("Cookie", cookie)
        .set("Origin", origin)
        .send({ ...body, days: [...body.days, { dayNumber: 32, date: null, activities: [] }] });
    assert.equal(invalid.status, 400);
    assert.equal(saved.length, 1);
});

test("Smart Create validates batches and accepts thirty photo IDs", async () => {
    const { api } = setup(Array.from({ length: 30 }, (_, index) => photo(index + 1)));
    for (const imageIds of [[], [0], [-1], [1.5], ["1"], Array.from({ length: 31 }, (_, index) => index + 1)]) {
        const response = await api
            .post("/api/v1/images/smart-create")
            .set("Cookie", cookie)
            .set("Origin", origin)
            .send({ imageIds });
        assert.equal(response.status, 400, `Invalid batch: ${JSON.stringify(imageIds)}`);
    }
    const response = await api
        .post("/api/v1/images/smart-create")
        .set("Cookie", cookie)
        .set("Origin", origin)
        .send({ imageIds: Array.from({ length: 30 }, (_, index) => index + 1) });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.photos.length, 30);
});

test("only the uploader can resolve a photo, even when it belongs to a published board", async () => {
    const { api, calls } = setup([photo(1), photo(2, { uploaderUserId: "other", boardId: 10 })]);
    for (const imageIds of [[2], [404], [1, 2]]) {
        const response = await api
            .post("/api/v1/images/smart-create")
            .set("Cookie", cookie)
            .set("Origin", origin)
            .send({ imageIds });
        assert.equal(response.status, 404);
        assert.equal(JSON.stringify(response.body).includes("roamboard/private"), false);
    }
    assert.deepEqual(calls, []);
});

test("nearby same-day photos reuse one Geoapify lookup while preserving upload response order", async () => {
    const { api, calls } = setup([
        photo(1),
        photo(2, { latitude: 48.8586, capturedAt: new Date("2026-06-21T10:00:00Z") }),
        photo(3, { capturedAt: new Date("2026-06-22T09:00:00Z") })
    ]);
    const response = await api
        .post("/api/v1/images/smart-create")
        .set("Cookie", cookie)
        .set("Origin", origin)
        .send({ imageIds: [2, 1, 3] });
    assert.equal(response.status, 200);
    assert.deepEqual(
        response.body.data.photos.map((entry: { imageId: number }) => entry.imageId),
        [2, 1, 3]
    );
    assert.equal(calls.length, 2);
    assert.equal(response.body.data.photos[0].location.label, "Eiffel Tower");
    assert.equal(response.body.data.photos[0].category, "landmark");
});

test("missing GPS avoids provider calls and provider failures do not lose usable uploads", async () => {
    const { api, calls } = setup([photo(1, { latitude: null, longitude: null }), photo(2)], async () => {
        throw new Error("secret provider credential should never escape");
    });
    const response = await api
        .post("/api/v1/images/smart-create")
        .set("Cookie", cookie)
        .set("Origin", origin)
        .send({ imageIds: [1, 2] });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.photos.length, 2);
    assert.equal(response.body.data.photos[0].location, null);
    assert.equal(calls.length, 1);
    assert.ok(response.body.data.photos[1].warning);
    assert.doesNotMatch(JSON.stringify(response.body), /secret provider credential/);
});

test("provider lookup reuse does not chain together distinct places or long visits", async () => {
    const { api, calls } = setup([
        photo(1),
        photo(2, { latitude: 48.8591 }),
        photo(3, { latitude: 48.8598 }),
        photo(4, { capturedAt: new Date("2026-06-21T14:00:00Z") })
    ]);
    const response = await api
        .post("/api/v1/images/smart-create")
        .set("Cookie", cookie)
        .set("Origin", origin)
        .send({ imageIds: [1, 2, 3, 4] });
    assert.equal(response.status, 200);
    assert.equal(calls.length, 3);
});
