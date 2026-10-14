import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";
import { createProviderService } from "../src/features/providers/provider.service.js";
import { reverseMapbox, routeMapbox } from "../src/features/providers/provider.providers.js";
import { parseUpload } from "../src/features/providers/provider.upload.js";
import { createSearchService } from "../src/features/search/search.service.js";
import type { SearchDocument, SearchProvider } from "../src/features/search/search.types.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { createApp } from "../src/app.js";

function service(reservations: string[]) {
    return createProviderService(
        {
            async reserve(id) {
                reservations.push(id);
            },
            async run(id, operation) {
                reservations.push(id);
                return operation();
            }
        },
        {
            async list() {
                return [];
            },
            async save(_userId, placeId) {
                return { placeId, savedAt: "2026-10-14T00:00:00Z" };
            },
            async delete() {
                return false;
            }
        }
    );
}

test("map sessions expose only public tokens and reserve before returning them", async (context) => {
    const names = ["MAPBOX_ACCESS_TOKEN", "MAPBOX_PUBLIC_TOKEN"];
    const originals = names.map((name) => process.env[name]);
    context.after(() =>
        names.forEach((name, index) => {
            if (originals[index] === undefined) delete process.env[name];
            else process.env[name] = originals[index];
        })
    );
    const reservations: string[] = [];
    const provider = service(reservations);
    process.env.MAPBOX_ACCESS_TOKEN = "sk.server-secret";
    delete process.env.MAPBOX_PUBLIC_TOKEN;
    await assert.rejects(provider.mapboxMapSession(), /not configured/);
    process.env.MAPBOX_PUBLIC_TOKEN = "sk.misconfigured-secret";
    await assert.rejects(provider.mapboxMapSession(), /public pk/);
    assert.deepEqual(reservations, []);
    process.env.MAPBOX_PUBLIC_TOKEN = "pk.public-display";
    assert.deepEqual(await provider.mapboxMapSession(), { publicToken: "pk.public-display" });
    assert.deepEqual(reservations, ["mapbox.map_loads"]);
    assert.equal(JSON.stringify(provider.config()).includes("pk.public-display"), false);
    assert.equal(JSON.stringify(provider.config()).includes("sk.server-secret"), false);
});

test("Mapbox adapters preserve longitude-latitude order and return kilometres and minutes", async (context) => {
    const urls: URL[] = [];
    context.mock.method(globalThis, "fetch", async (input: URL | string | Request) => {
        const url = new URL(String(input));
        urls.push(url);
        if (url.pathname.includes("reverse")) return Response.json({ features: [] });
        return Response.json({
            routes: [
                {
                    distance: 2450,
                    duration: 720,
                    geometry: {
                        coordinates: [
                            [18.07, 59.33],
                            [10.75, 59.91]
                        ]
                    }
                }
            ]
        });
    });
    const reversed = await reverseMapbox(59.33, 18.07, "sk.server");
    assert.equal(urls[0]?.searchParams.get("latitude"), "59.33");
    assert.equal(urls[0]?.searchParams.get("longitude"), "18.07");
    assert.equal(urls[0]?.searchParams.has("permanent"), false);
    assert.equal(reversed.latitude, 59.33);
    assert.equal(reversed.longitude, 18.07);
    const route = await routeMapbox(
        [
            { latitude: 59.33, longitude: 18.07 },
            { latitude: 59.91, longitude: 10.75 }
        ],
        "walking",
        "sk.server"
    );
    assert.equal(urls[1]?.pathname, "/directions/v5/mapbox/walking/18.07,59.33;10.75,59.91");
    assert.equal(route.distanceKm, 2.5);
    assert.equal(route.durationMinutes, 12);
    assert.deepEqual(route.geometry, [
        [18.07, 59.33],
        [10.75, 59.91]
    ]);
});

test("Cloudinary lab inspection cannot reach protected Board originals or traversal paths", async () => {
    const reservations: string[] = [];
    const provider = service(reservations);
    for (const publicId of ["roamboard/boards/original", "roamboard/provider-lab/../boards/original"]) {
        await assert.rejects(async () => provider.cloudinaryMetadata(publicId), /Lab image not found/);
    }
    assert.deepEqual(reservations, []);
});

test("multipart accepts browser-generic HEIC while rejecting empty, duplicate, oversized and unknown fields", async () => {
    const app = express();
    app.post("/upload", express.raw({ type: "multipart/form-data", limit: "11mb" }), parseUpload, (_req, res) =>
        res.json({ name: res.locals.file.originalname, bytes: res.locals.file.buffer.length })
    );
    app.use(errorHandler);
    const photo = await request(app).post("/upload").attach("file", Buffer.from("heic bytes"), {
        filename: "camera.HEIC",
        contentType: "application/octet-stream"
    });
    assert.equal(photo.status, 200);
    assert.deepEqual(photo.body, { name: "camera.HEIC", bytes: 10 });
    assert.equal((await request(app).post("/upload").attach("file", Buffer.alloc(0), "empty.jpg")).status, 400);
    assert.equal(
        (
            await request(app)
                .post("/upload")
                .attach("file", Buffer.from("a"), "a.jpg")
                .attach("file", Buffer.from("b"), "b.jpg")
        ).status,
        400
    );
    assert.equal((await request(app).post("/upload").attach("file", Buffer.alloc(10000001), "large.jpg")).status, 413);
    assert.equal(
        (await request(app).post("/upload").field("ownerId", "forged-owner").attach("file", Buffer.from("a"), "a.jpg"))
            .status,
        400
    );
});

test("search and suggestions discard Boards made private during the upstream request", async () => {
    const document: SearchDocument = {
        id: "7",
        entityType: "itinerary",
        title: "Public trip",
        description: "",
        city: "Stockholm",
        country: "Sweden",
        tags: [],
        categories: [],
        location: { lat: 59.33, lon: 18.07 },
        popularity: 0,
        isPublic: true,
        updatedAt: "2026-10-14T00:00:00Z"
    };
    let publicDocuments = [document];
    const provider: SearchProvider = {
        async search(_input, ids) {
            assert.deepEqual(ids, ["7"]);
            publicDocuments = [];
            return { hits: [{ id: "7", score: 1 }], total: 1 };
        },
        async suggestions(_query, _limit, ids) {
            assert.deepEqual(ids, ["7"]);
            publicDocuments = [];
            return ["7"];
        },
        async replace() {},
        async update() {}
    };
    const search = createSearchService(
        {
            async listPublic() {
                return publicDocuments;
            }
        },
        provider
    );
    assert.deepEqual((await search.search({ q: "trip", page: 1, limit: 10 })).hits, []);
    publicDocuments = [document];
    assert.deepEqual(await search.suggestions("tri", 6), []);
});

test("POI search uses Search Box and its own budget while Home retains city geocoding", async (context) => {
    const originalToken = process.env.MAPBOX_ACCESS_TOKEN;
    process.env.MAPBOX_ACCESS_TOKEN = "sk.mock-server-token";
    context.after(() => {
        if (originalToken === undefined) delete process.env.MAPBOX_ACCESS_TOKEN;
        else process.env.MAPBOX_ACCESS_TOKEN = originalToken;
    });
    const policies: string[] = [];
    const urls: URL[] = [];
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
        urls.push(url);
        if (url.pathname === "/search/geocode/v6/forward")
            return Response.json({
                features: [
                    {
                        id: "paris-city",
                        geometry: { coordinates: [2.35, 48.86] },
                        properties: {
                            name: "Paris",
                            feature_type: "place",
                            context: { country: { name: "France", country_code: "FR" } }
                        }
                    }
                ]
            });
        assert.equal(url.pathname, "/search/searchbox/v1/forward");
        assert.equal(url.searchParams.get("q"), "Paris landmarks and restaurants");
        assert.equal(url.searchParams.get("access_token"), "sk.mock-server-token");
        return Response.json({
            features: [
                {
                    geometry: { coordinates: [2.2945, 48.8584] },
                    properties: {
                        mapbox_id: "eiffel",
                        name: "Eiffel Tower",
                        feature_type: "poi",
                        full_address: "5 Avenue Anatole France, Paris, France",
                        poi_category: ["landmark"],
                        context: { place: { name: "Paris" }, country: { name: "France", country_code: "FR" } }
                    }
                },
                {
                    geometry: { coordinates: [2.33, 48.85] },
                    properties: {
                        mapbox_id: "restaurant",
                        name: "Le Restaurant",
                        feature_type: "poi",
                        poi_category: ["restaurant"],
                        context: { place: { name: "Paris" }, country: { name: "France", country_code: "FR" } }
                    }
                },
                { geometry: { coordinates: [2, "invalid"] }, properties: { name: "Malformed POI" } },
                { geometry: { coordinates: [181, 48] }, properties: { name: "Out of bounds" } },
                { geometry: { coordinates: [2, 91] }, properties: { name: "Invalid latitude" } }
            ]
        });
    });
    const pois = await request(app)
        .get("/api/v1/providers/mapbox/search")
        .query({ q: "Paris landmarks and restaurants" });
    assert.equal(pois.status, 200);
    assert.deepEqual(
        pois.body.data.map((place: { name: string }) => place.name),
        ["Eiffel Tower", "Le Restaurant"]
    );
    assert.equal(pois.body.data[0].id, "eiffel");
    assert.equal(pois.body.data[0].latitude, 48.8584);
    assert.equal(pois.body.data[0].longitude, 2.2945);
    assert.equal(pois.body.data[0].city, "Paris");
    assert.equal(pois.body.data[0].countryCode, "FRA");
    assert.equal(pois.body.data[0].placeType, "poi");
    assert.equal(pois.body.data[0].address, "5 Avenue Anatole France, Paris, France");
    const cities = await request(app).get("/api/v1/destinations/search?q=Paris");
    assert.equal(cities.status, 200);
    assert.equal(cities.body.data[0].name, "Paris");
    assert.equal(urls[1]?.pathname, "/search/geocode/v6/forward");
    assert.deepEqual(policies, ["mapbox.search_box", "mapbox.geocoding"]);
});

test("indexed search rejects standalone place and destination entity filters before accessing data", async () => {
    const app = createApp({
        searchRepository: {
            async listPublic() {
                throw new Error("Invalid filter must not reach the repository");
            }
        }
    });
    for (const entityType of ["place", "destination"]) {
        const response = await request(app).get("/api/v1/search").query({ q: "Paris", entityType });
        assert.equal(response.status, 400);
        assert.equal(response.body.error.code, "INVALID_REQUEST");
    }
});
