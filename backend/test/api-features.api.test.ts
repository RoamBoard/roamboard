import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import type { AuthRepository } from "../src/features/auth/auth.types.js";
import type { QuotaService } from "../src/features/quotas/quota.service.js";
import type { UsersRepository, UserProfile } from "../src/features/users/users.types.js";
import type { SearchDocument, SearchProvider } from "../src/features/search/search.types.js";
import { AppError } from "../src/shared/app-error.js";
import { createBoardsRepository } from "../src/features/boards/boards.repository.js";

const origin = "http://localhost:3000";
const cookie = "roamboard_session=owner-token";
const user = { userId: "owner", username: "owner", displayName: "Owner" };
const repository: AuthRepository = {
    async findUserById() {
        return user;
    },
    async createUser() {
        return user;
    },
    async createSession() {},
    async deleteSession() {},
    async findUserBySession(hash) {
        return hash === createHash("sha256").update("owner-token").digest("hex") ? user : null;
    }
};

function env(name: string, value: string | undefined, context: { after(fn: () => void): void }) {
    const original = process.env[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
    context.after(() => {
        if (original === undefined) delete process.env[name];
        else process.env[name] = original;
    });
}

test("developer tools require explicit development mode and a real session", async (context) => {
    env("NODE_ENV", "production", context);
    const app = createApp({ repository });
    for (const path of [
        "/api/v1/providers/cloudinary/assets",
        "/api/v1/providers/google-places/saved",
        "/api/v1/dev/boards"
    ]) {
        assert.equal((await request(app).get(path).set("Cookie", cookie)).status, 404);
    }
    process.env.NODE_ENV = "development";
    assert.equal(
        (await request(app).get("/api/v1/providers/cloudinary/assets").set("x-demo-user-id", "owner")).status,
        401
    );
    assert.equal(
        (
            await request(app)
                .post("/api/v1/providers/cloudinary/upload")
                .set("Cookie", cookie)
                .set("Origin", "https://attacker.test")
        ).status,
        403
    );
});

test("provider validation, missing keys, quotas and upstream errors have safe responses", async (context) => {
    env("UNSPLASH_ACCESS_KEY", undefined, context);
    const calls: string[] = [];
    const quota: QuotaService = {
        async reserve(id) {
            calls.push(id);
        },
        async run(id, operation) {
            calls.push(id);
            return operation();
        }
    };
    const app = createApp({ quotaService: quota });
    const config = await request(app).get("/api/v1/providers/config");
    assert.equal(config.status, 200);
    assert.equal(config.body.data.unsplash.configured, false);
    assert.equal(config.body.data.mapbox.publicToken, undefined);
    assert.equal((await request(app).get("/api/v1/providers/locations/reverse?latitude=91&longitude=0")).status, 400);
    assert.equal((await request(app).get("/api/v1/providers/unsplash/search?q=x")).status, 400);
    const missing = await request(app).get("/api/v1/providers/unsplash/search?q=Tokyo");
    assert.equal(missing.status, 503);
    assert.deepEqual(calls, []);
    process.env.UNSPLASH_ACCESS_KEY = "test-secret";
    context.mock.method(globalThis, "fetch", async () => new Response("secret upstream failure", { status: 403 }));
    const failure = await request(app).get("/api/v1/providers/unsplash/search?q=Tokyo");
    assert.equal(failure.status, 502);
    assert.equal(JSON.stringify(failure.body).includes("test-secret"), false);
    assert.equal(JSON.stringify(failure.body).includes("secret upstream failure"), false);
    assert.deepEqual(calls, ["unsplash.requests"]);
    const blocked = createApp({
        quotaService: {
            async reserve() {
                throw new AppError(429, "Limit reached", "PROVIDER_QUOTA_EXHAUSTED");
            },
            async run() {
                throw new AppError(429, "Limit reached", "PROVIDER_QUOTA_EXHAUSTED");
            }
        }
    });
    assert.equal((await request(blocked).get("/api/v1/providers/unsplash/search?q=Tokyo")).status, 429);
});

test("location and photo search map real provider payloads to the frontend contract", async (context) => {
    env("GEOAPIFY_API_KEY", "geo-key", context);
    env("UNSPLASH_ACCESS_KEY", "photo-key", context);
    const policies: string[] = [];
    const app = createApp({
        quotaService: {
            async reserve(id) {
                policies.push(id);
            },
            async run(id, operation) {
                policies.push(id);
                return operation();
            }
        }
    });
    context.mock.method(globalThis, "fetch", async (input: URL | string | Request) => {
        const url = new URL(String(input));
        if (url.hostname === "api.geoapify.com")
            return Response.json({
                features: [
                    {
                        properties: {
                            place_id: "city-id",
                            name: "Tokyo",
                            formatted: "Tokyo, Japan",
                            city: "Tokyo",
                            country: "Japan",
                            country_code: "jp",
                            lat: 35.68,
                            lon: 139.76,
                            result_type: "city"
                        }
                    }
                ]
            });
        return Response.json({
            results: [
                {
                    id: "photo",
                    urls: { regular: "https://images.unsplash.com/photo", small: "https://images.unsplash.com/thumb" },
                    links: { html: "https://unsplash.com/photos/photo" },
                    user: { name: "Photographer", links: { html: "https://unsplash.com/@photographer" } },
                    width: 100,
                    height: 80
                }
            ]
        });
    });
    const locations = await request(app).get("/api/v1/providers/locations/destinations?country=JPN&city=Tokyo");
    assert.equal(locations.status, 200);
    assert.equal(locations.body.data[0].city, "Tokyo");
    assert.equal(locations.body.data[0].countryCode, "JPN");
    assert.equal(locations.body.data[0].placeType, "place");
    const photos = await request(app).get("/api/v1/providers/unsplash/search?q=Tokyo");
    assert.equal(photos.status, 200);
    assert.equal(photos.body.data[0].photographer, "Photographer");
    assert.deepEqual(policies, ["geoapify.geocoding", "unsplash.requests"]);
});

test("destination context reports partial failures and preserves the chosen coordinates", async (context) => {
    env("UNSPLASH_ACCESS_KEY", undefined, context);
    const app = createApp({
        quotaService: {
            async reserve() {},
            async run(id, operation) {
                if (id === "wikipedia.action_api") throw new Error("offline");
                return operation();
            }
        }
    });
    context.mock.method(globalThis, "fetch", async () =>
        Response.json({
            timezone: "Asia/Tokyo",
            daily: {
                time: ["2026-10-14"],
                temperature_2m_min: [10],
                temperature_2m_max: [20],
                precipitation_probability_max: [0]
            }
        })
    );
    const result = await request(app).get(
        "/api/v1/destinations/context?id=tokyo&name=Tokyo&latitude=35.68&longitude=139.76&placeType=place"
    );
    assert.equal(result.status, 200);
    assert.equal(result.body.data.destination.latitude, 35.68);
    assert.equal(result.body.data.weather.timezone, "Asia/Tokyo");
    assert.deepEqual(result.body.data.unavailable.sort(), ["description", "image"]);
});

test("profile reads and writes use the session owner and reject forged identity", async () => {
    let profile: UserProfile = {
        id: "owner",
        username: "owner",
        displayName: "Owner",
        description: "",
        location: null,
        occupation: null,
        languages: [],
        interests: [],
        profilePicture: null,
        defaultBoardVisibility: "collaborators",
        revision: 1,
        createdAt: "2026-10-14T00:00:00Z",
        updatedAt: "2026-10-14T00:00:00Z"
    };
    const seen: string[] = [];
    const users: UsersRepository = {
        async read(id) {
            seen.push(id);
            return structuredClone(profile);
        },
        async update(id, changes) {
            seen.push(id);
            profile = { ...profile, ...changes, revision: profile.revision + 1 };
        },
        async setPicture() {
            throw new Error("must not be called");
        },
        async listBoards() {
            return [];
        },
        async stats() {
            return { boardsCreated: 0 };
        },
        async listSavedBoards() {
            return { items: [], hasMore: false };
        },
        async saveBoard() {
            return true;
        },
        async unsaveBoard() {
            return;
        }
    };
    const app = createApp({
        repository,
        usersRepository: users,
        boardRepository: {
            ...createBoardsRepository(),
            async listTags() {
                return [];
            },
            async getAccess(boardId) {
                if (boardId === 44) return null;
                return {
                    boardId,
                    ownerUserId: boardId === 43 ? "owner" : "friend",
                    status: "published",
                    visibility: "public",
                    revision: 1,
                    memberRole: null,
                    isFriend: false
                };
            }
        }
    });
    assert.equal((await request(app).get("/api/v1/users/me").set("x-demo-user-id", "owner")).status, 401);
    const changes = {
        revision: 1,
        username: "owner",
        displayName: "New name",
        description: "Traveller",
        location: "Stockholm",
        occupation: null,
        languages: [],
        interests: [],
        defaultBoardVisibility: "collaborators"
    };
    assert.equal((await request(app).patch("/api/v1/users/me").set("Cookie", cookie).send(changes)).status, 403);
    const saved = await request(app)
        .patch("/api/v1/users/me")
        .set("Cookie", cookie)
        .set("Origin", origin)
        .send(changes);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.data.displayName, "New name");
    const loaded = await request(app).get("/api/v1/users/me").set("Cookie", cookie);
    assert.equal(loaded.body.data.description, "Traveller");
    assert.equal((await request(app).get("/api/v1/languages")).status, 200);
    assert.equal((await request(app).put("/api/v1/boards/42/save").set("Cookie", cookie)).status, 403);
    const bookmark = await request(app).put("/api/v1/boards/42/save").set("Cookie", cookie).set("Origin", origin);
    assert.equal(bookmark.status, 201);
    assert.deepEqual(bookmark.body.data, { boardId: 42, saved: true });
    assert.equal(
        (await request(app).put("/api/v1/boards/43/save").set("Cookie", cookie).set("Origin", origin)).status,
        403
    );
    assert.equal(
        (await request(app).put("/api/v1/boards/44/save").set("Cookie", cookie).set("Origin", origin)).status,
        404
    );
    assert.equal(
        (await request(app).delete("/api/v1/boards/42/save").set("Cookie", cookie).set("Origin", origin)).status,
        204
    );
    assert.deepEqual(new Set(seen), new Set(["owner"]));
    assert.equal(
        (
            await request(app)
                .put("/api/v1/users/me/profile-picture")
                .set("Cookie", cookie)
                .set("Origin", origin)
                .send({ url: "https://example.com/image" })
        ).status,
        400
    );
    assert.equal(
        (
            await request(app)
                .patch("/api/v1/users/me")
                .set("Cookie", cookie)
                .set("Origin", origin)
                .send({ ...changes, userId: "someone-else" })
        ).status,
        400
    );
});

test("search and suggestions only return current public database documents", async (context) => {
    env("NODE_ENV", "development", context);
    const document: SearchDocument = {
        id: "7",
        entityType: "itinerary",
        title: "Tokyo today",
        description: "Current text",
        city: "Tokyo",
        country: "Japan",
        tags: [],
        categories: ["city"],
        location: { lat: 35, lon: 139 },
        popularity: 0,
        isPublic: true,
        updatedAt: "2026-10-14T00:00:00Z"
    };
    const publicIds: string[][] = [];
    const provider: SearchProvider = {
        async search(_input, ids) {
            publicIds.push(ids);
            return {
                hits: [
                    { id: "7", score: 2 },
                    { id: "private", score: 1 }
                ],
                total: 1
            };
        },
        async suggestions(_query, _limit, ids) {
            publicIds.push(ids);
            return ["7", "private", "7"];
        }
    };
    const app = createApp({
        repository,
        searchProvider: provider,
        searchRepository: {
            async listPublicIds() {
                return [document.id];
            },
            async listPublic(ids) {
                if (ids !== undefined) assert.deepEqual(ids, ["7", "private"]);
                return [document];
            }
        }
    });
    const result = await request(app).get("/api/v1/search?q=tokyo");
    assert.equal(result.status, 200);
    assert.deepEqual(
        result.body.data.hits.map((hit: { document: SearchDocument }) => hit.document.title),
        ["Tokyo today"]
    );
    assert.deepEqual((await request(app).get("/api/v1/search/suggestions?q=tok")).body.data, ["Tokyo today"]);
    assert.deepEqual(publicIds, [["7"], ["7"]]);
    assert.equal((await request(app).get("/api/v1/search?q=tokyo&limit=100")).status, 400);
});
