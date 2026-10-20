import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";
import { createDestinationModule } from "../src/features/destinations/destination.module.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import type { QuotaService } from "../src/features/quotas/quota.service.js";

const identity = { name: "Fukuoka", country: "JPN", latitude: 33.5902, longitude: 130.4017 };
const place = {
    id: "wikivoyage:12208:nakasu",
    provider: "wikivoyage",
    name: "Nakasu",
    address: "Fukuoka, Japan",
    latitude: 33.591,
    longitude: 130.407
};
const missingDetails = {
    placeId: place.id,
    description: null,
    sourceUrl: "https://en.wikivoyage.org/?curid=12208#Nakasu",
    image: null,
    unavailable: []
};
const quota: QuotaService = {
    async reserve() {},
    async run(_provider, operation) {
        return operation();
    }
};

// Exercise the public router with fake external boundaries, without a database or network.
function app(providers: Record<string, unknown> = {}, boardRead = async () => ({ boards: [], hasMore: false })) {
    const server = express();
    const module = Reflect.apply(createDestinationModule, undefined, [
        quota,
        {
            providers: {
                async matchPlace() {
                    return null;
                },
                async article() {
                    return {
                        title: "Fukuoka",
                        description: "A city in Japan.",
                        url: "https://en.wikivoyage.org/wiki/Fukuoka"
                    };
                },
                async images() {
                    return [];
                },
                async places() {
                    return [place];
                },
                async cityTip() {
                    return null;
                },
                async placeDetails() {
                    return missingDetails;
                },
                ...providers
            },
            repository: { listPublic: boardRead }
        }
    ]);
    server.use("/api/v1/destinations", module.router);
    server.use(errorHandler);
    return server;
}

test("public detail reads resolve the canonical listing without reading Boards or destination photos", async () => {
    const calls = { places: 0, details: 0 };
    const originalPlace = structuredClone(place);
    const server = app(
        {
            async places() {
                calls.places += 1;
                return [place];
            },
            async placeDetails(selected: unknown) {
                calls.details += 1;
                assert.deepEqual(selected, place);
                return { ...missingDetails, description: "Riverside streets with food stalls." };
            },
            images() {
                throw new Error("Detail reads must not search for city photos");
            }
        },
        async () => {
            throw new Error("Detail reads must not read Boards");
        }
    );
    for (const expectedReads of [1, 1]) {
        const response = await request(server)
            .get("/api/v1/destinations/place-details")
            .query({ ...identity, placeId: place.id })
            .expect(200);
        assert.equal(response.body.data.placeId, place.id);
        assert.equal(response.body.data.description, "Riverside streets with food stalls.");
        assert.equal(calls.details, expectedReads);
    }
    assert.deepEqual(calls, { places: 1, details: 1 });
    assert.deepEqual(place, originalPlace);
});

test("detail validation rejects incomplete identities and caller supplied URLs before provider calls", async () => {
    const server = app({
        places() {
            throw new Error("Validation should run first");
        }
    });
    for (const changes of [
        { placeId: "" },
        { placeId: "x".repeat(301) },
        { latitude: 91 },
        { country: "JP" },
        { name: " " },
        { pageUrl: "https://example.com/fake" },
        { imageUrl: "https://example.com/fake.jpg" }
    ]) {
        const response = await request(server)
            .get("/api/v1/destinations/place-details")
            .query({ ...identity, placeId: place.id, ...changes })
            .expect(400);
        assert.equal(response.body.error.code, "INVALID_REQUEST");
    }
});

test("country details resolve a distant listing with its country scope before accepting its ID", async () => {
    const country = { ...identity, name: "Japan", kind: "country" };
    const server = app({
        async places(input: unknown) {
            assert.deepEqual(input, { ...country, country: "Japan", countryCode: "JPN" });
            return [place];
        },
        async placeDetails(selected: unknown, _observe: unknown, kind: unknown) {
            assert.deepEqual(selected, place);
            assert.equal(kind, "country");
            return { ...missingDetails, description: "Riverside streets in Japan." };
        }
    });
    const response = await request(server)
        .get("/api/v1/destinations/place-details")
        .query({ ...country, placeId: place.id })
        .expect(200);
    assert.equal(response.body.data.description, "Riverside streets in Japan.");
});

test("an ID from another city's guide cannot obtain details", async () => {
    const server = app({
        placeDetails() {
            throw new Error("A foreign ID must not reach the provider");
        }
    });
    const response = await request(server)
        .get("/api/v1/destinations/place-details")
        .query({ ...identity, placeId: "wikivoyage:999:eiffel tower" })
        .expect(404);
    assert.equal(response.body.error.code, "NOT_FOUND");
});

test("missing detail content and an independently failed image remain successful distinguishable results", async () => {
    const missing = await request(app())
        .get("/api/v1/destinations/place-details")
        .query({ ...identity, placeId: place.id })
        .expect(200);
    assert.deepEqual(missing.body.data, missingDetails);
    const partial = await request(
        app({
            async placeDetails() {
                return { ...missingDetails, description: "The listing's own description.", unavailable: ["image"] };
            }
        })
    )
        .get("/api/v1/destinations/place-details")
        .query({ ...identity, placeId: place.id })
        .expect(200);
    assert.equal(partial.body.data.description, "The listing's own description.");
    assert.equal(partial.body.data.image, null);
    assert.deepEqual(partial.body.data.unavailable, ["image"]);
});

test("failed canonical lists return a safe provider failure and can be retried", async () => {
    const calls = { count: 0 };
    const server = app({
        async places() {
            calls.count += 1;
            if (calls.count === 1) throw new Error("private upstream credentials");
            return [place];
        }
    });
    const failed = await request(server)
        .get("/api/v1/destinations/place-details")
        .query({ ...identity, placeId: place.id })
        .expect(502);
    assert.doesNotMatch(JSON.stringify(failed.body), /private upstream credentials/);
    await request(server)
        .get("/api/v1/destinations/place-details")
        .query({ ...identity, placeId: place.id })
        .expect(200);
    assert.equal(calls.count, 2);
});

test("a partially failed detail lookup is retried rather than cached for an hour", async () => {
    const calls = { count: 0 };
    const server = app({
        async placeDetails() {
            calls.count += 1;
            return { ...missingDetails, unavailable: calls.count === 1 ? ["image"] : [] };
        }
    });
    const first = await request(server)
        .get("/api/v1/destinations/place-details")
        .query({ ...identity, placeId: place.id })
        .expect(200);
    assert.deepEqual(first.body.data.unavailable, ["image"]);
    const retry = await request(server)
        .get("/api/v1/destinations/place-details")
        .query({ ...identity, placeId: place.id })
        .expect(200);
    assert.deepEqual(retry.body.data.unavailable, []);
    assert.equal(calls.count, 2);
});

test("city transport tips load independently from the introduction and distinguish absent from failed", async () => {
    const tip = {
        title: "Getting around",
        text: "Use the subway to reach the city centre.",
        url: "https://en.wikivoyage.org/wiki/Fukuoka#Get_around"
    };
    const withTip = await request(
        app({
            async cityTip() {
                return tip;
            }
        })
    )
        .get("/api/v1/destinations/guide")
        .query(identity)
        .expect(200);
    assert.deepEqual(withTip.body.data.cityTip, tip);
    const absent = await request(app()).get("/api/v1/destinations/guide").query(identity).expect(200);
    assert.equal(absent.body.data.cityTip, null);
    assert.ok(!absent.body.data.unavailable.includes("cityTip"));
    const failed = await request(
        app({
            async cityTip() {
                throw new Error("private transport failure");
            }
        })
    )
        .get("/api/v1/destinations/guide")
        .query(identity)
        .expect(200);
    assert.equal(failed.body.data.article.description, "A city in Japan.");
    assert.equal(failed.body.data.cityTip, null);
    assert.ok(failed.body.data.unavailable.includes("cityTip"));
    assert.doesNotMatch(JSON.stringify(failed.body), /private transport failure/);
});
