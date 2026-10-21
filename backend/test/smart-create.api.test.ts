import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import request from "supertest";
import { createApp, type AppOptions } from "../src/app.js";
import type { AuthRepository } from "../src/features/auth/auth.types.js";
import type {
    ImageProvider,
    ImagesRepository,
    ProviderAsset,
    UploadedImage
} from "../src/features/images/images.types.js";
import type { MapboxLocation } from "../src/features/providers/provider.types.js";
import { cloudinaryPhotoMetadata } from "../src/features/images/photo-metadata.js";
import type { BoardDocument, BoardRepository } from "../src/features/boards/boards.types.js";
import type { ProviderQuotaSignal } from "../src/features/quotas/quota.types.js";
import { findActivityPhoto, matchesActivityPhoto } from "../src/features/providers/provider.activity-photo.js";
import type { ActivityPhotoRequest } from "../src/features/providers/provider.schemas.js";

const origin = "http://localhost:3000";
const cookie = "roamboard_session=smart-create-owner";
const photoTarget: ActivityPhotoRequest = {
    name: "Uluwatu Temple",
    city: "Badung",
    country: "Indonesia",
    latitude: -8.8291,
    longitude: 115.0849
};

function unsplashPhoto(id = "temple", overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id,
        description: "Uluwatu Temple in Badung, Indonesia",
        alt_description: "Temple above the sea",
        width: 1600,
        height: 900,
        location: { city: "Badung", country: "Indonesia" },
        urls: {
            regular: `https://images.unsplash.com/photo-${id}`,
            small: `https://images.unsplash.com/photo-${id}?w=320`
        },
        user: { name: "Travel Photographer", links: { html: "https://unsplash.com/@traveller" } },
        links: {
            html: `https://unsplash.com/photos/${id}`,
            download_location: `https://api.unsplash.com/photos/${id}/download`
        },
        ...overrides
    };
}

test("activity photos need their own precise location evidence rather than generic search relevance", () => {
    assert.equal(matchesActivityPhoto(unsplashPhoto(), photoTarget), true);
    assert.equal(
        matchesActivityPhoto(
            unsplashPhoto("gps", {
                description: "Sea",
                alt_description: "Blue water",
                location: { position: { latitude: -8.8292, longitude: 115.0849 } }
            }),
            photoTarget
        ),
        true
    );
    assert.equal(
        matchesActivityPhoto(
            unsplashPhoto("generic", {
                description: "A temple in Bali",
                alt_description: "Indonesia beach",
                location: {}
            }),
            photoTarget
        ),
        false
    );
    assert.equal(
        matchesActivityPhoto(
            unsplashPhoto("ambiguous", { description: "Uluwatu Temple", alt_description: null, location: {} }),
            photoTarget
        ),
        false
    );
    assert.equal(
        matchesActivityPhoto(
            unsplashPhoto("wrong-gps", {
                location: { city: "Badung", country: "Indonesia", position: { latitude: 8.8291, longitude: 115.0849 } }
            }),
            photoTarget
        ),
        false
    );
    assert.equal(
        matchesActivityPhoto(
            unsplashPhoto("wrong-city", {
                description: "Uluwatu Temple",
                alt_description: "Temple",
                location: { city: "Paris", country: "France" }
            }),
            photoTarget
        ),
        false
    );
    assert.equal(
        matchesActivityPhoto(
            unsplashPhoto("substring", {
                description: "New Uluwatu Templeton in Badung Indonesia",
                alt_description: null,
                location: {}
            }),
            photoTarget
        ),
        false
    );
    assert.equal(
        matchesActivityPhoto(
            unsplashPhoto("accent", { description: "CAFÉ DE FLORE in PARIS", alt_description: null, location: {} }),
            { name: "Cafe de Flore", city: "Paris", country: "France", latitude: 48.85, longitude: 2.33 }
        ),
        true
    );
});

test("strict activity photo discovery checks at most three details and never broadens its place query", async () => {
    const paths: string[] = [];
    const result = await findActivityPhoto(photoTarget, async (path) => {
        paths.push(path);
        if (path.startsWith("/search/photos?"))
            return { results: [1, 2, 3, 4, 5].map((id) => ({ id: `candidate-${id}` })) };
        return unsplashPhoto(path.split("/").at(-1), {
            description: "Generic sunset",
            alt_description: "Beach",
            location: {}
        });
    });
    assert.equal(result, null);
    assert.equal(paths.length, 4);
    assert.equal(paths.filter((path) => path.startsWith("/search/photos?")).length, 1);
    assert.equal(
        new URL(paths[0]!, "https://api.unsplash.com").searchParams.get("query"),
        "Uluwatu Temple Badung Indonesia"
    );
    assert.deepEqual(paths.slice(1), ["/photos/candidate-1", "/photos/candidate-2", "/photos/candidate-3"]);
});

test("strict activity photos retain valid credits and track downloads only on explicit selection", async () => {
    for (const select of [false, true]) {
        const paths: string[] = [];
        const result = await findActivityPhoto(
            photoTarget,
            async (path) => {
                paths.push(path);
                if (path.startsWith("/search/photos?")) return { results: [{ id: "temple" }] };
                return unsplashPhoto();
            },
            select
        );
        assert.equal(result?.id, "temple");
        assert.equal(result?.photographer, "Travel Photographer");
        assert.equal(new URL(result!.sourceUrl).searchParams.get("utm_source"), "roamboard");
        assert.equal(new URL(result!.photographerUrl).searchParams.get("utm_source"), "roamboard");
        assert.equal(paths.includes("/photos/temple/download"), select);
    }
});

test("strict activity photos reject invalid credits, image URLs and hostile selection links", async () => {
    for (const overrides of [
        { user: { name: "", links: { html: "https://unsplash.com/@traveller" } } },
        {
            urls: {
                regular: "https://images.unsplash.com.evil.example/photo",
                small: "https://images.unsplash.com/small"
            }
        },
        { links: { html: "http://unsplash.com/photos/temple" } }
    ]) {
        assert.equal(
            await findActivityPhoto(photoTarget, async (path) =>
                path.startsWith("/search/") ? { results: [{ id: "temple" }] } : unsplashPhoto("temple", overrides)
            ),
            null
        );
    }
    const paths: string[] = [];
    await assert.rejects(
        findActivityPhoto(
            photoTarget,
            async (path) => {
                paths.push(path);
                return path.startsWith("/search/")
                    ? { results: [{ id: "temple" }] }
                    : unsplashPhoto("temple", {
                          links: {
                              html: "https://unsplash.com/photos/temple",
                              download_location: "https://evil.example/photos/temple/download"
                          }
                      });
            },
            true
        ),
        /Invalid photo selection link/
    );
    assert.equal(paths.length, 2);
});
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
    quotaService?: AppOptions["quotaService"],
    imageProvider?: ImageProvider
) {
    const calls: Array<[number, number]> = [];
    const updates: Array<{ imageId: number; asset: Pick<ProviderAsset, "capturedAt" | "latitude" | "longitude"> }> = [];
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
        async updateMetadata(imageId, asset) {
            updates.push({ imageId, asset });
            const record = records.find((image) => image.imageId === imageId);
            if (record) Object.assign(record, asset);
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
        imageProvider,
        boardRepository,
        quotaService,
        smartCreateResolver: quotaService
            ? undefined
            : async (latitude, longitude) => {
                  calls.push([latitude, longitude]);
                  return resolver ? resolver(latitude, longitude) : location;
              }
    });
    return { api: request(app), calls, updates };
}

function refreshProvider(inspect: ImageProvider["inspect"]): ImageProvider {
    return {
        inspect,
        authorizeUpload() {
            throw new Error("Refresh must not authorize a new upload");
        },
        async openVariant() {
            throw new Error("Refresh must inspect the original, not read a display variant");
        },
        async destroy() {
            throw new Error("Refresh must never delete image storage");
        }
    };
}

function correctedAsset(storageKey: string, overrides: Partial<ProviderAsset> = {}): ProviderAsset {
    return {
        storageKey,
        format: "jpg",
        byteSize: 1000,
        createdAt: new Date("2026-06-21T00:00:00Z"),
        capturedAt: new Date("2026-06-21T11:30:00Z"),
        latitude: -8.8,
        longitude: 115.1,
        ...overrides
    };
}

test("refresh location reinspects the uploader's original and persists corrected southern GPS", async () => {
    const inspected: string[] = [];
    const original = photo(1, { latitude: 8.8, longitude: 115.1, boardId: 7 });
    const { api, calls, updates } = setup(
        [original],
        async (latitude, longitude) => ({
            ...location,
            label: "Bali Beach",
            detail: "Bali Beach",
            type: "beach",
            latitude,
            longitude,
            country: "Indonesia",
            countryCode: "IDN",
            city: null
        }),
        undefined,
        undefined,
        refreshProvider(async (storageKey) => {
            inspected.push(storageKey);
            return correctedAsset(storageKey);
        })
    );
    const response = await api
        .post("/api/v1/images/1/refresh-location")
        .set("Cookie", cookie)
        .set("Origin", origin)
        .send({});
    assert.equal(response.status, 200);
    assert.deepEqual(inspected, ["roamboard/private/1"]);
    assert.deepEqual(calls, [[-8.8, 115.1]]);
    assert.equal(updates.length, 1);
    assert.equal(updates[0]?.imageId, 1);
    assert.equal(original.latitude, -8.8);
    assert.equal(response.body.data.imageId, 1);
    assert.equal(response.body.data.latitude, -8.8);
    assert.equal(response.body.data.longitude, 115.1);
    assert.equal(response.body.data.capturedAt, "2026-06-21T11:30:00.000Z");
    assert.equal(response.body.data.location.label, "Bali Beach");
    assert.equal(response.body.data.category, "beach");
    assert.doesNotMatch(JSON.stringify(response.body), /roamboard\/private/);
});

test("refresh authenticates, validates origin and ID, and verifies ownership before inspection", async () => {
    const inspected: string[] = [];
    const { api, calls, updates } = setup(
        [photo(1), photo(2, { uploaderUserId: "other", boardId: 7 })],
        undefined,
        undefined,
        undefined,
        refreshProvider(async (storageKey) => {
            inspected.push(storageKey);
            return correctedAsset(storageKey);
        })
    );
    assert.equal((await api.post("/api/v1/images/1/refresh-location").set("Origin", origin).send({})).status, 401);
    assert.equal(
        (
            await api
                .post("/api/v1/images/1/refresh-location")
                .set("Cookie", cookie)
                .set("Origin", "https://untrusted.example")
                .send({})
        ).status,
        403
    );
    assert.equal((await api.post("/api/v1/images/1/refresh-location").set("Cookie", cookie).send({})).status, 403);
    for (const id of ["0", "-1", "1.5", "not-an-id"]) {
        assert.equal(
            (
                await api
                    .post(`/api/v1/images/${id}/refresh-location`)
                    .set("Cookie", cookie)
                    .set("Origin", origin)
                    .send({})
            ).status,
            400
        );
    }
    for (const id of [2, 999]) {
        const response = await api
            .post(`/api/v1/images/${id}/refresh-location`)
            .set("Cookie", cookie)
            .set("Origin", origin)
            .send({});
        assert.equal(response.status, 404);
        assert.doesNotMatch(JSON.stringify(response.body), /roamboard\/private/);
    }
    assert.deepEqual(inspected, []);
    assert.deepEqual(calls, []);
    assert.deepEqual(updates, []);
});

test("refresh retains a photo without GPS and returns a safe warning without place lookup", async () => {
    const { api, calls, updates } = setup(
        [photo(1)],
        undefined,
        undefined,
        undefined,
        refreshProvider(async (storageKey) =>
            correctedAsset(storageKey, { latitude: null, longitude: null, capturedAt: null })
        )
    );
    const response = await api
        .post("/api/v1/images/1/refresh-location")
        .set("Cookie", cookie)
        .set("Origin", origin)
        .send({});
    assert.equal(response.status, 200);
    assert.equal(response.body.data.latitude, null);
    assert.equal(response.body.data.longitude, null);
    assert.equal(response.body.data.capturedAt, null);
    assert.equal(response.body.data.location, null);
    assert.ok(response.body.data.warning);
    assert.deepEqual(calls, []);
    assert.equal(updates.length, 1);
});

test("refresh keeps corrected metadata when the place provider fails and never exposes provider secrets", async () => {
    const { api, updates } = setup(
        [photo(1)],
        async () => {
            throw new Error("SECRET-GEOAPIFY-CREDENTIAL");
        },
        undefined,
        undefined,
        refreshProvider(async (storageKey) => correctedAsset(storageKey))
    );
    const response = await api
        .post("/api/v1/images/1/refresh-location")
        .set("Cookie", cookie)
        .set("Origin", origin)
        .send({});
    assert.equal(response.status, 200);
    assert.equal(response.body.data.latitude, -8.8);
    assert.equal(response.body.data.longitude, 115.1);
    assert.ok(response.body.data.warning);
    assert.equal(updates.length, 1);
    assert.doesNotMatch(JSON.stringify(response.body), /SECRET-GEOAPIFY-CREDENTIAL|roamboard\/private/);
});

test("refresh of missing or unavailable original assets does not overwrite stored metadata or leak details", async () => {
    for (const unavailable of [false, true]) {
        const original = photo(1);
        const before = structuredClone(original);
        const { api, calls, updates } = setup(
            [original],
            undefined,
            undefined,
            undefined,
            refreshProvider(async () => {
                if (unavailable) throw new Error("SECRET-CLOUDINARY-CREDENTIAL roamboard/private/1");
                return null;
            })
        );
        const response = await api
            .post("/api/v1/images/1/refresh-location")
            .set("Cookie", cookie)
            .set("Origin", origin)
            .send({});
        assert.ok(response.status >= 400 && response.status < 600);
        assert.doesNotMatch(JSON.stringify(response.body), /SECRET-CLOUDINARY-CREDENTIAL|roamboard\/private/);
        assert.deepEqual(original, before);
        assert.deepEqual(updates, []);
        assert.deepEqual(calls, []);
    }
});

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

test("activity location search biases category queries near the board without restricting distant named searches", async (context) => {
    const previousKey = process.env.GEOAPIFY_API_KEY;
    process.env.GEOAPIFY_API_KEY = "fake-search-key";
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
        urls.push(new URL(String(input)));
        return Response.json({
            features: [
                {
                    properties: {
                        place_id: "cafe",
                        name: "Provider first cafe",
                        lat: -8.8,
                        lon: 115.1,
                        categories: ["catering.cafe"]
                    }
                },
                {
                    properties: {
                        place_id: "restaurant",
                        name: "Provider second restaurant",
                        lat: -8.7,
                        lon: 115.2,
                        categories: ["catering.restaurant"]
                    }
                }
            ]
        });
    });
    const { api } = setup([], undefined, undefined, quotaService);
    const queries = [
        { q: "restaurants", latitude: -8.8, longitude: 115.1 },
        { q: "Eiffel Tower Paris", latitude: -8.8, longitude: 115.1 },
        { q: "Bali beach" }
    ];
    for (const query of queries) {
        const response = await api.get("/api/v1/providers/locations/search").query(query);
        assert.equal(response.status, 200);
        assert.deepEqual(
            response.body.data.map((place: { name: string }) => place.name),
            ["Provider first cafe", "Provider second restaurant"]
        );
    }
    assert.equal(urls.length, 3, "Each search should issue exactly one upstream request");
    assert.equal(urls[0]?.pathname, "/v2/places");
    assert.equal(urls[0]?.searchParams.get("categories"), "catering.restaurant");
    assert.equal(urls[0]?.searchParams.get("bias"), "proximity:115.1,-8.8");
    assert.equal(urls[1]?.pathname, "/v1/geocode/search");
    assert.equal(urls[1]?.searchParams.get("text"), "Eiffel Tower Paris");
    assert.equal(urls[1]?.searchParams.get("bias"), "proximity:115.1,-8.8");
    assert.equal(urls[2]?.pathname, "/v1/geocode/search");
    assert.equal(urls[2]?.searchParams.get("text"), "Bali beach");
    assert.equal(urls[2]?.searchParams.has("bias"), false);
    assert.ok(urls.every((url) => !url.searchParams.has("filter")));
    assert.deepEqual(
        policies,
        queries.map(() => "geoapify.geocoding")
    );
    assert.deepEqual(
        observations.map((signal) => signal.status),
        [200, 200, 200]
    );
});

test("strict activity photo discovery is read-only while selection requires session and frontend Origin", async (context) => {
    const previousKey = process.env.UNSPLASH_ACCESS_KEY;
    process.env.UNSPLASH_ACCESS_KEY = "fake-unsplash-secret";
    context.after(() => {
        if (previousKey === undefined) delete process.env.UNSPLASH_ACCESS_KEY;
        else process.env.UNSPLASH_ACCESS_KEY = previousKey;
    });
    const urls: URL[] = [];
    const policies: string[] = [];
    const observations: ProviderQuotaSignal[] = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        const url = new URL(String(input));
        urls.push(url);
        assert.equal(url.origin, "https://api.unsplash.com");
        return Response.json(
            url.pathname === "/search/photos"
                ? { results: [{ id: "temple" }] }
                : url.pathname.endsWith("/download")
                  ? {}
                  : unsplashPhoto()
        );
    });
    const { api } = setup([], undefined, undefined, {
        async reserve() {},
        async run(policy, operation) {
            policies.push(policy);
            return operation(async (signal) => {
                observations.push(signal);
            });
        }
    });
    const path = "/api/v1/providers/unsplash/activity-photo";
    assert.equal((await api.post(path).set("Origin", origin).send(photoTarget)).status, 401);
    assert.equal(
        (await api.post(path).set("Cookie", cookie).set("Origin", "https://evil.example").send(photoTarget)).status,
        403
    );
    assert.equal(urls.length, 0);
    const discovered = await api.get(path).query(photoTarget);
    assert.equal(discovered.status, 200);
    assert.equal(discovered.body.data.id, "temple");
    assert.equal(urls.length, 2);
    assert.ok(urls.every((url) => !url.pathname.endsWith("/download")));
    const selected = await api.post(path).set("Cookie", cookie).set("Origin", origin).send(photoTarget);
    assert.equal(selected.status, 200);
    assert.equal(selected.body.data.id, "temple");
    assert.equal(urls.length, 5);
    assert.equal(urls[4]?.pathname, "/photos/temple/download");
    assert.deepEqual(
        policies,
        Array.from({ length: 5 }, () => "unsplash.requests")
    );
    assert.deepEqual(
        observations.map((signal) => signal.status),
        [200, 200, 200, 200, 200]
    );
    assert.doesNotMatch(JSON.stringify(selected.body), /fake-unsplash-secret/);
});

test("strict activity photo endpoints reject absent, empty and null coordinates before any provider calls", async (context) => {
    const fetched: boolean[] = [];
    const policies: string[] = [];
    context.mock.method(globalThis, "fetch", async () => {
        fetched.push(true);
        return Response.json({ results: [] });
    });
    const { api } = setup([], undefined, undefined, {
        async reserve(policy) {
            policies.push(policy);
        },
        async run(policy, operation) {
            policies.push(policy);
            return operation();
        }
    });
    const path = "/api/v1/providers/unsplash/activity-photo";
    for (const latitude of [null, "", "   ", false, 91]) {
        const response = await api
            .post(path)
            .set("Cookie", cookie)
            .set("Origin", origin)
            .send({ ...photoTarget, latitude });
        assert.equal(response.status, 400, `Invalid latitude ${JSON.stringify(latitude)} must not be treated as zero`);
    }
    assert.equal((await api.get(path).query({ ...photoTarget, latitude: "" })).status, 400);
    assert.equal((await api.get(path).query({ name: photoTarget.name, longitude: photoTarget.longitude })).status, 400);
    assert.deepEqual(fetched, []);
    assert.deepEqual(policies, []);
});

test("activity location search rejects incomplete or invalid proximity before calling providers", async (context) => {
    const fetched: boolean[] = [];
    const policies: string[] = [];
    context.mock.method(globalThis, "fetch", async () => {
        fetched.push(true);
        return Response.json({ features: [] });
    });
    const { api } = setup([], undefined, undefined, {
        async reserve(policy) {
            policies.push(policy);
        },
        async run(policy, operation) {
            policies.push(policy);
            return operation();
        }
    });
    for (const query of [
        { q: "restaurant", latitude: -8.8 },
        { q: "restaurant", longitude: 115.1 },
        { q: "restaurant", latitude: 91, longitude: 115.1 },
        { q: "restaurant", latitude: -8.8, longitude: 181 },
        { q: "restaurant", latitude: "bad", longitude: 115.1 }
    ]) {
        assert.equal((await api.get("/api/v1/providers/locations/search").query(query)).status, 400);
    }
    assert.deepEqual(fetched, []);
    assert.deepEqual(policies, []);
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

test("Cloudinary expanded hemisphere references keep Bali south of the equator", () => {
    for (const [GPSLatitudeRef, GPSLongitudeRef] of [
        ["South", "East"],
        ["SOUTH", "EAST"]
    ]) {
        const metadata = cloudinaryPhotoMetadata({
            image_metadata: {
                GPSLatitude: [8, 48, 0],
                GPSLatitudeRef,
                GPSLongitude: [115, 6, 0],
                GPSLongitudeRef
            }
        });
        assert.equal(metadata.latitude, -8.8, `Latitude reference ${GPSLatitudeRef}`);
        assert.equal(metadata.longitude, 115.1, `Longitude reference ${GPSLongitudeRef}`);
    }
});

test("Cloudinary expanded West references preserve western longitude", () => {
    for (const GPSLongitudeRef of ["West", "WEST"]) {
        const metadata = cloudinaryPhotoMetadata({
            exif: {
                GPSLatitude: 8.8,
                GPSLatitudeRef: "South",
                GPSLongitude: 115.1,
                GPSLongitudeRef
            }
        });
        assert.equal(metadata.longitude, -115.1, `Longitude reference ${GPSLongitudeRef}`);
    }
});

test("Cloudinary DMS coordinate strings accept expanded hemisphere suffixes", () => {
    const metadata = cloudinaryPhotoMetadata({
        media_metadata: {
            GPSLatitude: "8 deg 48' 0\" South",
            GPSLongitude: "115 deg 6' 0\" East"
        }
    });
    assert.equal(metadata.latitude, -8.8);
    assert.equal(metadata.longitude, 115.1);
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
        getFillerPool: async () => null,
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
                fillerImagesEnabled: false,
                fillerImages: [],
                fillerImageStatus: "disabled",
                commentCount: 0,
                ...input,
                boardId: 1,
                revision: 1,
                isCompleted: false,
                coverImageId: 1,
                author: { username: "owner", bio: "", photo: null },
                savedByMe: false,
                savedCount: 0,
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
