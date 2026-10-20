import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";
import { createDiscoveryModule } from "../src/features/board-discovery/discovery.module.js";
import { collectionQuerySchema } from "../src/features/board-discovery/discovery.schemas.js";
import type {
    DiscoveryCandidate,
    DiscoveryRepository,
    Place
} from "../src/features/board-discovery/discovery.types.js";
import type { BoardRepository } from "../src/features/boards/boards.types.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { continentForCountry } from "../src/shared/continents.js";

const place = (country: string): Place => ({ name: country, city: null, country, address: null });
function board(boardId: number, countries: string[], fields: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate {
    return {
        boardId,
        title: "Food adventure",
        description: "",
        status: "published",
        visibility: "public",
        owner: { username: "author", displayName: "Author", photoUrl: null },
        destination: countries[0] ? place(countries[0]) : null,
        coverImageUrl: null,
        tags: [],
        durationDays: 2,
        activityCount: 1,
        savedCount: 0,
        savedByMe: false,
        firstPublishedAt: "2026-10-10T00:00:00Z",
        updatedAt: "2026-10-10T00:00:00Z",
        permissions: { canEditContent: false, canManageBoard: false },
        owned: false,
        locations: countries.slice(1).map(place),
        activityText: "",
        viewers: 0,
        guests: 0,
        savers: 0,
        commenters: 0,
        ...fields
    };
}
function harness(items: DiscoveryCandidate[]) {
    const repository: DiscoveryRepository = {
        async candidates() {
            return structuredClone(items);
        },
        async browser() {
            return "browser";
        },
        async mergeBrowser() {},
        async startView() {
            return "token";
        },
        async finishView() {
            return false;
        }
    };
    const app = express();
    app.use(
        "/api/v1",
        createDiscoveryModule(
            (_req, res, next) => {
                res.locals.user = null;
                next();
            },
            {} as BoardRepository,
            repository
        ).router
    );
    app.use(errorHandler);
    return app;
}

test("geography accepts single/repeated selections, deduplicates, and rejects malformed values", async () => {
    const parsed = collectionQuerySchema.parse({ countries: ["FRA", "FRA", "BGD"], continents: "europe" });
    assert.deepEqual(parsed.countries, ["FRA", "BGD"]);
    assert.deepEqual(parsed.continents, ["europe"]);
    const app = harness([]);
    for (const query of [
        "countries=",
        "countries=fra",
        "countries=XXX",
        "continents=americas",
        "continents=",
        "countries[x]=FRA",
        "countries=FRA&q=x"
    ]) {
        assert.equal((await request(app).get(`/api/v1/boards/search?${query}`)).status, 400, query);
    }
    assert.equal((await request(app).get("/api/v1/boards/search")).status, 400);
    assert.equal((await request(app).get("/api/v1/boards/search?countries=FRA&q=%20")).status, 200);
    assert.equal((await request(app).get("/api/v1/boards/search/suggestions?countries=FRA")).status, 400);
});

test("country and continent groups intersect at Board level and cannot be bypassed by text", async () => {
    const app = harness([
        board(1, ["BGD", "FRA"]),
        board(2, ["BGD"]),
        board(3, ["FRA"]),
        board(4, [], { title: "France Food" })
    ]);
    for (const endpoint of ["search?q=Food", "search?q=Food&location=off", "search", "collections/recent"]) {
        const response = await request(app).get(
            `/api/v1/boards/${endpoint}${endpoint.includes("?") ? "&" : "?"}countries=BGD&continents=europe`
        );
        assert.equal(response.status, 200);
        assert.deepEqual(
            response.body.data.items.map((item: { boardId: number }) => item.boardId),
            [1]
        );
        assert.equal(response.body.data.total, 1);
    }
    const union = await request(app).get(
        "/api/v1/boards/search?countries=BGD&countries=FRA&continents=asia&continents=europe"
    );
    assert.deepEqual(
        new Set(union.body.data.items.map((item: { boardId: number }) => item.boardId)),
        new Set([1, 2, 3])
    );
    const empty = await request(app).get("/api/v1/boards/search?countries=USA&continents=europe");
    assert.equal(empty.status, 200);
    assert.equal(empty.body.data.total, 0);
});

test("filter-only results sort by publication with stable ties and filter before counts/page slicing", async () => {
    const app = harness([
        ...Array.from({ length: 25 }, (_, index) => board(index + 1, ["FRA"])),
        ...Array.from({ length: 25 }, (_, index) =>
            board(index + 101, ["BGD"], { firstPublishedAt: "2026-10-20T00:00:00Z" })
        )
    ]);
    for (const endpoint of ["search", "collections/recent"]) {
        const response = await request(app).get(`/api/v1/boards/${endpoint}?countries=FRA&page=2`);
        assert.equal(response.status, 200);
        assert.equal(response.body.data.total, 25);
        assert.equal(response.body.data.hasMore, false);
        assert.deepEqual(
            response.body.data.items.map((item: { boardId: number }) => item.boardId),
            [5, 4, 3, 2, 1]
        );
    }
    const suggestions = await request(app).get("/api/v1/boards/search/suggestions?q=Food&countries=FRA");
    assert.equal(suggestions.body.data.total, 25);
    assert.equal(suggestions.body.data.items.length, 4);
    assert.ok(suggestions.body.data.items.every((item: { boardId: number }) => item.boardId <= 25));
});

test("Featured geographic narrowing preserves the selected ten Board source without refilling", async () => {
    const app = harness([
        ...Array.from({ length: 10 }, (_, index) =>
            board(index + 1, [index === 0 ? "FRA" : "BGD"], { viewers: 100 - index })
        ),
        board(11, ["FRA"])
    ]);
    const response = await request(app).get("/api/v1/boards/collections/featured?countries=FRA");
    assert.equal(response.status, 200);
    assert.equal(response.body.data.total, 1);
    assert.deepEqual(
        response.body.data.items.map((item: { boardId: number }) => item.boardId),
        [1]
    );
});

test("North America, South America and Antarctica are distinct geographic selections", async () => {
    const app = harness([board(1, ["USA"]), board(2, ["BRA"]), board(3, ["ATA"])]);
    for (const [continent, id] of [
        ["north-america", 1],
        ["south-america", 2],
        ["antarctica", 3]
    ] as const) {
        const response = await request(app).get(`/api/v1/boards/search?continents=${continent}`);
        assert.equal(response.status, 200);
        assert.deepEqual(
            response.body.data.items.map((item: { boardId: number }) => item.boardId),
            [id]
        );
    }
    assert.equal(continentForCountry("USA"), "North America");
    assert.equal(continentForCountry("BRA"), "South America");
    assert.equal(continentForCountry("ATA"), "Antarctica");
});
