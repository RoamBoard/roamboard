import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import type { SearchDocument } from "../src/features/search/search.types.js";

const document: SearchDocument = {
    id: "7",
    entityType: "itinerary",
    title: "Stockholm weekend",
    description: "Museums and islands",
    city: "Stockholm",
    country: "Sweden",
    tags: ["design"],
    categories: ["culture"],
    location: { lat: 59.3, lon: 18.1 },
    popularity: 0,
    isPublic: true,
    updatedAt: "2026-10-15T00:00:00Z"
};

test("default search provider reads publication changes and deletions on every request", async () => {
    let records = [document];
    const app = createApp({
        searchRepository: {
            async listPublicIds() {
                return records.map((record) => record.id);
            },
            async listPublic(ids) {
                return structuredClone(records.filter((record) => ids === undefined || ids.includes(record.id)));
            }
        }
    });
    const initial = await request(app).get("/api/v1/search?q=stokholm");
    assert.equal(initial.status, 200);
    assert.deepEqual(
        initial.body.data.hits.map((hit: { document: SearchDocument }) => hit.document.id),
        ["7"]
    );
    assert.deepEqual((await request(app).get("/api/v1/search/suggestions?q=sto")).body.data, ["Stockholm weekend"]);

    records = [{ ...document, title: "Tokyo weekend", city: "Tokyo" }];
    assert.equal((await request(app).get("/api/v1/search?q=stockholm")).body.data.total, 0);
    assert.equal((await request(app).get("/api/v1/search?q=tokyo")).body.data.total, 1);
    assert.deepEqual((await request(app).get("/api/v1/search/suggestions?q=sto")).body.data, []);

    // The repository exposes only public published Boards, so a draft or private transition removes it.
    records = [];
    assert.equal((await request(app).get("/api/v1/search?q=tokyo")).body.data.total, 0);
    assert.deepEqual((await request(app).get("/api/v1/search/suggestions?q=tok")).body.data, []);
    records = [document];
    assert.equal((await request(app).get("/api/v1/search?q=stockholm")).body.data.total, 1);
    records = [];
    assert.equal((await request(app).get("/api/v1/search?q=stockholm")).body.data.total, 0);
});

test("default search validates queries and applies filters and pagination", async () => {
    const records = [document, { ...document, id: "8", title: "Stockholm food", categories: ["food"] }];
    const app = createApp({
        searchRepository: {
            async listPublicIds() {
                return records.map((record) => record.id);
            },
            async listPublic(ids) {
                return records.filter((record) => ids === undefined || ids.includes(record.id));
            }
        }
    });
    const filtered = await request(app).get("/api/v1/search?q=stockholm&country=sweden&category=culture");
    assert.equal(filtered.status, 200);
    assert.deepEqual(
        filtered.body.data.hits.map((hit: { document: SearchDocument }) => hit.document.id),
        ["7"]
    );
    const second = await request(app).get("/api/v1/search?q=stockholm&page=2&limit=1");
    assert.equal(second.status, 200);
    assert.equal(second.body.data.total, 2);
    assert.equal(second.body.data.hits.length, 1);
    assert.equal(second.body.data.page, 2);
    assert.equal((await request(app).get("/api/v1/search?q=x")).status, 400);
    assert.equal((await request(app).get("/api/v1/search?q=stockholm&limit=100")).status, 400);
});
