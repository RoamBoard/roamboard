import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import request from "supertest";
import { createDestinationModule } from "../src/features/destinations/destination.module.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import type { QuotaObserver } from "../src/features/quotas/quota.types.js";
import type { GuideDestination } from "../src/features/destinations/destination.types.js";

const query = { name: "Paris", country: "FRA", latitude: 48.8566, longitude: 2.3522 };

function guideApp(t: TestContext) {
    const previous = {
        images: process.env.UNSPLASH_ACCESS_KEY,
        geo: process.env.GEOAPIFY_API_KEY,
        mapbox: process.env.MAPBOX_ACCESS_TOKEN
    };
    process.env.UNSPLASH_ACCESS_KEY = "test-images-key";
    delete process.env.GEOAPIFY_API_KEY;
    delete process.env.MAPBOX_ACCESS_TOKEN;
    t.after(() => {
        for (const [name, value] of Object.entries({
            UNSPLASH_ACCESS_KEY: previous.images,
            GEOAPIFY_API_KEY: previous.geo,
            MAPBOX_ACCESS_TOKEN: previous.mapbox
        })) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
    });
    const state = { now: 0, mode: "match", places: 0, boards: 0 };
    const reservations: string[] = [];
    // Guide order deliberately differs from proximity order.
    const places = [
        {
            id: "wikivoyage:120:landmark",
            provider: "wikivoyage" as const,
            name: "Landmark",
            address: "",
            latitude: 48.95,
            longitude: 2.35
        },
        {
            id: "wikivoyage:120:nearby-museum",
            provider: "wikivoyage" as const,
            name: "Nearby museum",
            address: "",
            latitude: 48.8567,
            longitude: 2.3522
        }
    ];
    const module = createDestinationModule(
        {
            async reserve() {},
            async run(id, operation) {
                reservations.push(id);
                return operation(async () => {});
            }
        },
        {
            now: () => state.now,
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
                async article() {
                    return null;
                },
                async images() {
                    return [];
                },
                async places(city: GuideDestination, observe?: QuotaObserver) {
                    assert.equal(city.name, "Paris");
                    assert.equal(typeof observe, "function", "Wikimedia calls must receive their quota observer");
                    state.places += 1;
                    await new Promise((resolve) => setTimeout(resolve, 5));
                    if (state.mode === "fail") throw new Error("Private upstream detail");
                    return state.mode === "empty" ? [] : places;
                }
            },
            repository: {
                async listPublic() {
                    state.boards += 1;
                    return { boards: [], hasMore: false };
                }
            }
        }
    );
    const server = express();
    server.use("/api/v1/destinations", module.router);
    server.use(errorHandler);
    return { server, state, reservations, places };
}

test("travel-guide sights retain guide order and share a one-hour Wikimedia cache across concurrent and paginated reads", async (t) => {
    const { server, state, reservations, places } = guideApp(t);
    const read = (changes = {}) =>
        request(server)
            .get("/api/v1/destinations/guide")
            .query({ ...query, ...changes })
            .expect(200);
    const [first, next] = await Promise.all([read(), read({ page: 2 })]);
    assert.deepEqual(first.body.data.places, places);
    assert.deepEqual(next.body.data.places, places);
    assert.deepEqual(first.body.data.unavailable, []);
    assert.equal(state.places, 1);
    assert.equal(state.boards, 2);
    assert.equal(
        reservations.filter((id) => id === "wikipedia.action_api").length,
        3,
        "Article, sights and city tips reserve their own Wikimedia calls"
    );
    assert.ok(reservations.every((id) => !id.startsWith("mapbox.") && !id.startsWith("geoapify.")));
    state.now = 3_600_001;
    await read();
    assert.equal(state.places, 2);
    await read({ country: "USA", latitude: 33.66, longitude: -95.55 });
    assert.equal(state.places, 3);
});

test("empty travel guides remain empty without nearest-place substitution or provider credentials", async (t) => {
    const { server, state } = guideApp(t);
    state.mode = "empty";
    for (const page of [1, 2]) {
        const response = await request(server)
            .get("/api/v1/destinations/guide")
            .query({ ...query, page })
            .expect(200);
        assert.deepEqual(response.body.data.places, []);
        assert.deepEqual(response.body.data.unavailable, []);
    }
    assert.equal(state.places, 1);
});

test("failed travel-guide reads stay independent and uncached so an explicit retry can recover", async (t) => {
    const { server, state, places } = guideApp(t);
    state.mode = "fail";
    const failed = await request(server).get("/api/v1/destinations/guide").query(query).expect(200);
    assert.deepEqual(failed.body.data.places, []);
    assert.deepEqual(failed.body.data.unavailable, ["places"]);
    assert.doesNotMatch(JSON.stringify(failed.body), /Private upstream/);
    state.mode = "match";
    const recovered = await request(server).get("/api/v1/destinations/guide").query(query).expect(200);
    assert.deepEqual(recovered.body.data.places, places);
    assert.equal(state.places, 2);
});
