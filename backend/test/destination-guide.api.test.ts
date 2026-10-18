import assert from "node:assert/strict";
import test, { beforeEach, afterEach } from "node:test";
import express from "express";
import request from "supertest";
import { createDestinationModule } from "../src/features/destinations/destination.module.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import type { QuotaService } from "../src/features/quotas/quota.service.js";

const identity = { name: "Paris", country: "FRA", latitude: 48.8566, longitude: 2.3522 };
const originalGeoapifyKey = process.env.GEOAPIFY_API_KEY;
beforeEach(() => {
    process.env.GEOAPIFY_API_KEY = "test-geoapify-key";
});
afterEach(() => {
    if (originalGeoapifyKey === undefined) delete process.env.GEOAPIFY_API_KEY;
    else process.env.GEOAPIFY_API_KEY = originalGeoapifyKey;
});
const photo = (id: string) => ({
    id,
    url: `https://images.unsplash.com/${id}?w=1000`,
    thumbnailUrl: `https://images.unsplash.com/${id}?w=300`,
    alt: "Paris streets",
    photographer: "Ada",
    photographerUrl: "https://unsplash.com/@ada",
    sourceUrl: `https://unsplash.com/photos/${id}`,
    width: 1000,
    height: 600
});
const quota: QuotaService = {
    async reserve() {},
    async run(_id, operation) {
        return operation();
    }
};

function app(options: Record<string, unknown>) {
    const server = express();
    const providers = options.providers as Record<string, unknown> | undefined;
    // The real destination router, validation, controller and service run against external boundary fakes.
    const module = Reflect.apply(createDestinationModule, undefined, [
        quota,
        {
            ...options,
            ...(providers
                ? {
                      providers: {
                          async cityTip() {
                              return null;
                          },
                          async matchPlace() {
                              return null;
                          },
                          async placeDetails() {
                              throw new Error("Guide reads must not fetch selected-sight details");
                          },
                          async places() {
                              return [];
                          },
                          ...providers
                      }
                  }
                : {})
        }
    ]);
    server.use("/api/v1/destinations", module.router);
    server.use(errorHandler);
    return server;
}

test("anonymous guide reads return the selected identity, article, distinct photos and fresh paged Boards", async (t) => {
    const original = process.env.UNSPLASH_ACCESS_KEY;
    process.env.UNSPLASH_ACCESS_KEY = "test-photo-key";
    t.after(() => {
        if (original === undefined) delete process.env.UNSPLASH_ACCESS_KEY;
        else process.env.UNSPLASH_ACCESS_KEY = original;
    });
    const calls = { articles: 0, images: 0, boards: 0 };
    const board = {
        boardId: 23,
        username: "actual_user",
        title: "Station walk",
        description: null,
        durationDays: 2,
        tags: ["Architecture"],
        activityTitles: ["Station"],
        images: [{ url: "/api/v1/images/8/content?variant=display", alt: "Station walk" }]
    };
    const server = app({
        providers: {
            async article(destination: unknown) {
                calls.articles += 1;
                assert.deepEqual(destination, { ...identity, country: "France", countryCode: "FRA" });
                return {
                    title: "Paris",
                    description: "Unedited opening text.",
                    url: "https://en.wikipedia.org/wiki/Paris"
                };
            },
            async images(query: string) {
                calls.images += 1;
                assert.equal(query, "Paris France");
                return [photo("one"), photo("one"), photo("two"), photo("three")];
            }
        },
        repository: {
            async listPublic(input: unknown) {
                calls.boards += 1;
                assert.deepEqual(input, { ...identity, page: calls.boards, limit: 6 });
                return { boards: calls.boards === 1 ? [board] : [], hasMore: calls.boards === 1 };
            }
        }
    });
    const first = await request(server).get("/api/v1/destinations/guide").query(identity).expect(200);
    assert.deepEqual(first.body.data.destination, { ...identity, country: "France", countryCode: "FRA" });
    assert.equal(first.body.data.article.description, "Unedited opening text.");
    assert.deepEqual(
        first.body.data.images.map((image: { id: string }) => image.id),
        ["one", "two"]
    );
    assert.deepEqual(first.body.data.boards, [board]);
    assert.equal(first.body.data.page, 1);
    assert.equal(first.body.data.hasMore, true);
    assert.deepEqual(first.body.data.unavailable, []);
    const next = await request(server)
        .get("/api/v1/destinations/guide")
        .query({ ...identity, page: 2 })
        .expect(200);
    assert.deepEqual(next.body.data.boards, []);
    assert.equal(next.body.data.hasMore, false);
    assert.deepEqual(calls, { articles: 1, images: 1, boards: 2 });
});

test("guide validation rejects incomplete, malformed and unknown inputs before calling any dependency", async () => {
    const server = app({
        providers: {
            article() {
                throw new Error("Must not run");
            },
            images() {
                throw new Error("Must not run");
            }
        },
        repository: {
            listPublic() {
                throw new Error("Must not run");
            }
        }
    });
    for (const query of [
        { ...identity, name: " " },
        { ...identity, country: "FR" },
        { ...identity, country: "ZZZ" },
        { ...identity, latitude: "" },
        { ...identity, longitude: " " },
        { ...identity, latitude: 91 },
        { ...identity, longitude: "NaN" },
        { ...identity, page: 0 },
        { ...identity, limit: 21 },
        { ...identity, extra: "unsupported" },
        { name: "Paris", country: "FRA", longitude: 2.35 }
    ]) {
        const response = await request(server).get("/api/v1/destinations/guide").query(query).expect(400);
        assert.equal(response.body.error.code, "INVALID_REQUEST");
    }
});

test("provider and Board failures are independent and never replace failures with invented results", async (t) => {
    const original = process.env.UNSPLASH_ACCESS_KEY;
    process.env.UNSPLASH_ACCESS_KEY = "test-photo-key";
    t.after(() => {
        if (original === undefined) delete process.env.UNSPLASH_ACCESS_KEY;
        else process.env.UNSPLASH_ACCESS_KEY = original;
    });
    const calls = { article: 0, images: 0 };
    const server = app({
        providers: {
            async article() {
                calls.article += 1;
                throw new Error("private provider detail");
            },
            async images() {
                calls.images += 1;
                return [];
            }
        },
        repository: {
            async listPublic() {
                throw new Error("private database detail");
            }
        }
    });
    for (const attempt of [1, 2]) {
        const response = await request(server).get("/api/v1/destinations/guide").query(identity).expect(200);
        assert.equal(response.body.data.article, null);
        assert.deepEqual(response.body.data.images, []);
        assert.deepEqual(response.body.data.boards, []);
        assert.deepEqual(response.body.data.unavailable, ["description", "boards"]);
        assert.doesNotMatch(JSON.stringify(response.body), /private/);
        assert.equal(calls.article, attempt);
    }
    assert.equal(calls.images, 1);
});

test("guide cache shares simultaneous provider calls, expires after an hour and separates same-name cities", async (t) => {
    const original = process.env.UNSPLASH_ACCESS_KEY;
    process.env.UNSPLASH_ACCESS_KEY = "test-photo-key";
    t.after(() => {
        if (original === undefined) delete process.env.UNSPLASH_ACCESS_KEY;
        else process.env.UNSPLASH_ACCESS_KEY = original;
    });
    const clock = { now: 0 };
    const calls = { article: 0, images: 0, boards: 0 };
    const server = app({
        now: () => clock.now,
        providers: {
            async article() {
                calls.article += 1;
                await new Promise((resolve) => setTimeout(resolve, 10));
                return null;
            },
            async images() {
                calls.images += 1;
                return [];
            }
        },
        repository: {
            async listPublic() {
                calls.boards += 1;
                return { boards: [], hasMore: false };
            }
        }
    });
    const read = (query = identity) => request(server).get("/api/v1/destinations/guide").query(query).expect(200);
    await Promise.all([read(), read()]);
    assert.deepEqual(calls, { article: 1, images: 1, boards: 2 });
    await read({ name: "Paris", country: "USA", latitude: 33.6609, longitude: -95.5555 });
    assert.deepEqual(calls, { article: 2, images: 2, boards: 3 });
    clock.now = 3_600_001;
    await read();
    assert.deepEqual(calls, { article: 3, images: 3, boards: 4 });
});

test("default guide adapters forward quota feedback and keep usable photos unique by URL path", async (t) => {
    const original = process.env.UNSPLASH_ACCESS_KEY;
    const originalMapbox = process.env.MAPBOX_ACCESS_TOKEN;
    process.env.UNSPLASH_ACCESS_KEY = "test-photo-key";
    process.env.MAPBOX_ACCESS_TOKEN = "test-mapbox-key";
    t.after(() => {
        if (original === undefined) delete process.env.UNSPLASH_ACCESS_KEY;
        else process.env.UNSPLASH_ACCESS_KEY = original;
        if (originalMapbox === undefined) delete process.env.MAPBOX_ACCESS_TOKEN;
        else process.env.MAPBOX_ACCESS_TOKEN = originalMapbox;
    });
    const reservations: string[] = [];
    const feedback: number[] = [];
    const providerUrls: URL[] = [];
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        const url = new URL(String(input));
        providerUrls.push(url);
        if (url.hostname === "en.wikipedia.org" || url.hostname === "en.wikivoyage.org")
            return Response.json({ query: { pages: [] } });
        assert.equal(url.searchParams.get("orientation"), "landscape");
        assert.equal(url.searchParams.get("query"), "Paris France");
        const result = (id: string, path: string, width = 1000, height = 600) => ({
            id,
            urls: {
                regular: `https://images.unsplash.com/${path}?id=${id}`,
                small: `https://images.unsplash.com/${path}?w=300`
            },
            alt_description: "Paris",
            user: { name: "Ada", links: { html: "https://unsplash.com/@ada" } },
            links: { html: `https://unsplash.com/photos/${id}` },
            width,
            height
        });
        return Response.json({
            results: [
                result("one", "same"),
                result("duplicate", "same"),
                result("portrait", "portrait", 400, 800),
                result("square", "square", 600, 600),
                result("unknown-size", "unknown-size", 0, 0),
                result("two", "second")
            ]
        });
    });
    const server = express();
    const module = createDestinationModule(
        {
            async reserve() {},
            async run(id, operation) {
                reservations.push(id);
                return operation(async ({ status }) => {
                    feedback.push(status);
                });
            }
        },
        {
            repository: {
                async listPublic() {
                    return { boards: [], hasMore: false };
                }
            }
        }
    );
    server.use("/api/v1/destinations", module.router);
    server.use(errorHandler);
    const response = await request(server).get("/api/v1/destinations/guide").query(identity).expect(200);
    assert.equal(response.body.data.article, null);
    assert.deepEqual(
        response.body.data.images.map((image: { id: string }) => image.id),
        ["one", "two"]
    );
    assert.deepEqual(response.body.data.unavailable, []);
    assert.deepEqual([...reservations].sort(), [
        "unsplash.requests",
        "wikipedia.action_api",
        "wikipedia.action_api",
        "wikipedia.action_api"
    ]);
    assert.deepEqual(feedback, [200, 200, 200, 200]);
    assert.equal(providerUrls.length, 4);
});

test("missing image configuration reports images unavailable while retaining a matched article and empty Board search", async (t) => {
    const original = process.env.UNSPLASH_ACCESS_KEY;
    delete process.env.UNSPLASH_ACCESS_KEY;
    t.after(() => {
        if (original !== undefined) process.env.UNSPLASH_ACCESS_KEY = original;
    });
    const server = app({
        providers: {
            async article() {
                return { title: "Paris", description: "Original text", url: "https://en.wikipedia.org/wiki/Paris" };
            },
            async images() {
                throw new Error("Unconfigured image provider must not run");
            }
        },
        repository: {
            async listPublic() {
                return { boards: [], hasMore: false };
            }
        }
    });
    const response = await request(server).get("/api/v1/destinations/guide").query(identity).expect(200);
    assert.equal(response.body.data.article.title, "Paris");
    assert.deepEqual(response.body.data.unavailable, ["images"]);
    assert.deepEqual(response.body.data.boards, []);
});

test("provider caches evict the oldest city after sixty-four entries", async (t) => {
    const original = process.env.UNSPLASH_ACCESS_KEY;
    process.env.UNSPLASH_ACCESS_KEY = "test-photo-key";
    t.after(() => {
        if (original === undefined) delete process.env.UNSPLASH_ACCESS_KEY;
        else process.env.UNSPLASH_ACCESS_KEY = original;
    });
    const calls = { article: 0, images: 0 };
    const server = app({
        now: () => 0,
        providers: {
            async article() {
                calls.article += 1;
                return null;
            },
            async images() {
                calls.images += 1;
                return [];
            }
        },
        repository: {
            async listPublic() {
                return { boards: [], hasMore: false };
            }
        }
    });
    for (let index = 0; index < 65; index += 1)
        await request(server)
            .get("/api/v1/destinations/guide")
            .query({ ...identity, name: `City ${index}` })
            .expect(200);
    await request(server)
        .get("/api/v1/destinations/guide")
        .query({ ...identity, name: "City 0" })
        .expect(200);
    assert.deepEqual(calls, { article: 66, images: 66 });
    await request(server)
        .get("/api/v1/destinations/guide")
        .query({ ...identity, name: "City 64" })
        .expect(200);
    assert.deepEqual(calls, { article: 66, images: 66 });
});
