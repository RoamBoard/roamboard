import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import express from "express";
import { createDiscoveryModule } from "../src/features/board-discovery/discovery.module.js";
import { rankSearch, featuredBoards } from "../src/features/board-discovery/discovery.ranking.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import type {
    DiscoveryCandidate,
    DiscoveryRepository,
    Place
} from "../src/features/board-discovery/discovery.types.js";
import type { BoardAccess, BoardRepository } from "../src/features/boards/boards.types.js";

const stockholm: Place = { name: "Stockholm", city: "Stockholm", country: "SWE", address: null };
const copenhagen: Place = { name: "Copenhagen", city: "Copenhagen", country: "DNK", address: null };
function board(boardId: number, fields: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate {
    return {
        boardId,
        title: "Weekend escape",
        description: "",
        status: "published",
        visibility: "public",
        owner: { username: "author", displayName: "Author", photoUrl: null },
        destination: stockholm,
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
        locations: [],
        activityText: "",
        viewers: 0,
        guests: 0,
        savers: 0,
        commenters: 0,
        ...fields
    };
}
const search = (items: DiscoveryCandidate[], q: string, location: "auto" | "off" = "auto") =>
    rankSearch(items, { q, location, page: 1, limit: 20 }).boards.map((item) => item.boardId);

test("search includes owned Boards and direct title matches alongside location matches", () => {
    const items = [
        board(1),
        board(2, {
            title: "Sweden food tour",
            destination: { ...stockholm, name: "Sweden", city: null },
            locations: [stockholm]
        }),
        board(3, { title: "Stockholm food", destination: copenhagen, savedCount: 10000 }),
        board(4, { title: "Stockholm food", owned: true })
    ];
    assert.deepEqual(search(items, "Stockholm food"), [4, 3, 2, 1]);
    assert.deepEqual(search(items, "Stockholm"), [4, 1, 3, 2]);
});

test("topics are optional within a location; café synonyms outrank quiet descriptors", () => {
    const items = [
        board(1),
        board(2, { title: "Peaceful retreat" }),
        board(3, { title: "Coffee trail" }),
        board(4, { title: "Quiet cafés" }),
        board(5, { title: "Coffee", destination: copenhagen })
    ];
    assert.deepEqual(search(items, "Stockholm quiet cafés"), [4, 3, 2, 1]);
    assert.deepEqual(search(items, "cafés"), [4, 5, 3]);
    assert.deepEqual(search(items, "unmatchedtopic"), []);
});

test("removing location interpretation permits normal text search", () => {
    const items = [board(1), board(2, { title: "Stockholm reading list", destination: copenhagen })];
    assert.deepEqual(search(items, "Stockholm"), [1, 2]);
    assert.deepEqual(search(items, "Stockholm", "off"), [2, 1]);
});

test("a direct title match remains eligible without matching location metadata", () => {
    assert.deepEqual(search([board(1, { title: "Stockholm inspiration", destination: copenhagen })], "Stockholm"), [1]);
});

test("punctuation-only queries return empty results rather than crashing", async () => {
    const { app } = harness([board(1)]);
    const response = await request(app).get("/api/v1/boards/search").query({ q: "!!" });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.items, []);
});

test("an ambiguous destination prefix keeps all matching places eligible", () => {
    const items = [
        board(1),
        board(2, { destination: { name: "Stockbridge", city: "Stockbridge", country: "GBR", address: null } })
    ];
    assert.deepEqual(new Set(search(items, "Stock")), new Set([1, 2]));
});

test("Paris France comes first and explicit Texas qualifier excludes France", () => {
    const paris = (country: string, address: string): Place => ({ name: "Paris", city: "Paris", country, address });
    const items = [
        board(1, { destination: paris("USA", "Paris, Texas"), savedCount: 1000 }),
        board(2, { destination: paris("FRA", "Paris, France") })
    ];
    assert.deepEqual(search(items, "Paris"), [2, 1]);
    assert.deepEqual(search(items, "Paris in Texas"), [1]);
});

test("Featured uses weighted unique activity then public recency then friend publication, capped at ten", () => {
    const items = [
        board(1, { viewers: 9 }),
        board(2, { savers: 1, commenters: 1 }),
        board(3, { guests: 20 }),
        board(4, { savers: 2 }),
        board(5, { firstPublishedAt: "2026-10-19T00:00:00Z" }),
        board(6, { visibility: "friends", viewers: 10000, firstPublishedAt: "2026-01-01T00:00:00Z" }),
        board(7, { visibility: "friends", firstPublishedAt: "2026-10-20T00:00:00Z" })
    ];
    assert.deepEqual(
        featuredBoards(items).map((item) => item.boardId),
        [4, 2, 3, 1, 5, 7, 6]
    );
    assert.equal(featuredBoards(Array.from({ length: 15 }, (_, index) => board(index))).length, 10);
});

function harness(items: DiscoveryCandidate[] = []) {
    const access: BoardAccess = {
        boardId: 1,
        ownerUserId: "owner",
        status: "published",
        visibility: "public",
        revision: 1,
        memberRole: null,
        isFriend: false
    };
    const calls: {
        context?: Parameters<DiscoveryRepository["candidates"]>[3];
        days?: number;
        starts: number;
        finishes: number;
    } = { starts: 0, finishes: 0 };
    const token = "73fb6c5e-6b43-4699-b753-c092306cd935";
    const repository: DiscoveryRepository = {
        async candidates(_userId, _scope, days, context) {
            calls.context = context;
            calls.days = days;
            return structuredClone(items);
        },
        async browser() {
            return "f526bd16-ed86-43fb-a1f4-69df3b3bb5fd";
        },
        async mergeBrowser() {},
        async startView() {
            calls.starts++;
            return token;
        },
        async finishView() {
            calls.finishes++;
            return true;
        }
    };
    const boards = {
        async getAccess() {
            return access;
        }
    } as unknown as BoardRepository;
    const app = express();
    app.use(express.json());
    app.use(
        "/api/v1",
        createDiscoveryModule(
            (_req, res, next) => {
                res.locals.user = _req.get("x-test-user") ? { userId: _req.get("x-test-user") } : null;
                next();
            },
            boards,
            repository
        ).router
    );
    app.use(errorHandler);
    return { app, access, calls, token };
}

test("discovery HTTP validates pagination, caps suggestions, and never exposes internal ranking fields", async () => {
    const { app } = harness(Array.from({ length: 25 }, (_, index) => board(index + 1)));
    const response = await request(app).get("/api/v1/boards/search?q=Stockholm&page=2");
    assert.equal(response.status, 200);
    assert.equal(response.body.data.items.length, 5);
    assert.equal(response.body.data.total, 25);
    assert.equal(response.body.data.hasMore, false);
    assert.match(response.headers["cache-control"] ?? "", /no-store/);
    for (const field of ["owned", "locations", "activityText", "viewers", "guests", "savers", "commenters"])
        assert.equal(field in response.body.data.items[0], false);
    const suggestions = await request(app).get("/api/v1/boards/search/suggestions?q=Stockholm");
    assert.equal(suggestions.body.data.items.length, 4);
    for (const query of ["q=x", "q=Stockholm&page=0", "q=Stockholm&page=1.5", "q=Stockholm&limit=100"])
        assert.equal((await request(app).get(`/api/v1/boards/search?${query}`)).status, 400);
    assert.equal((await request(app).get("/api/v1/boards/mine")).status, 401);
});

test("Featured defaults to rolling month and requests seven days only for week", async () => {
    const { app, calls } = harness();
    assert.equal((await request(app).get("/api/v1/boards/featured")).body.data.period, "month");
    assert.equal(calls.days, 30);
    await request(app).get("/api/v1/boards/featured?period=week");
    assert.equal(calls.days, 7);
    assert.equal((await request(app).get("/api/v1/boards/featured?period=year")).status, 400);
});

test("view HTTP requires Origin, challenges before counting, excludes owners and denies inaccessible boards", async () => {
    const { app, access, calls, token } = harness();
    assert.equal((await request(app).post("/api/v1/boards/1/views").send({})).status, 403);
    const start = await request(app).post("/api/v1/boards/1/views").set("Origin", "http://localhost:3000").send({});
    assert.equal(start.status, 200);
    assert.equal(start.body.data.counted, false);
    assert.equal(start.body.data.token, token);
    assert.equal(calls.finishes, 0);
    assert.match(start.headers["set-cookie"]?.[0] ?? "", /HttpOnly/);
    const finish = await request(app)
        .post("/api/v1/boards/1/views")
        .set("Origin", "http://localhost:3000")
        .send({ token });
    assert.equal(finish.body.data.counted, true);
    const own = await request(app)
        .post("/api/v1/boards/1/views")
        .set("Origin", "http://localhost:3000")
        .set("x-test-user", "owner")
        .send({});
    assert.equal(own.body.data.counted, false);
    assert.equal(calls.starts, 1);
    access.visibility = "friends";
    assert.equal(
        (await request(app).post("/api/v1/boards/1/views").set("Origin", "http://localhost:3000").send({})).status,
        404
    );
    assert.equal(calls.starts, 1);
});

test("Bali title remains searchable with missing metadata and Indonesia matches canonical country", () => {
    const items = [
        board(31, { title: "bali vila with da boys", destination: null, owned: true }),
        board(32, { title: "Island holiday", destination: { name: "Bali", city: null, country: "IDN", address: null } })
    ];
    assert.deepEqual(new Set(search(items, "Bali")), new Set([31, 32]));
    assert.deepEqual(search(items, "Indonesia"), [32]);
    assert.deepEqual(
        search(
            [board(33, { owner: { username: "traveler", displayName: "Teoman", photoUrl: null } })],
            "Teoman",
            "off"
        ),
        [33]
    );
});

test("collection HTTP paginates all matches, sorts, validates contexts, and protects personal reads", async () => {
    const { app } = harness(
        Array.from({ length: 25 }, (_, index) =>
            board(index + 1, { title: index === 0 ? "Zebra Bali" : "Bali adventure", savedCount: index })
        )
    );
    const response = await request(app).get("/api/v1/boards/collections/recent?q=Bali&sort=saved-count-desc&page=2");
    assert.equal(response.status, 200);
    assert.equal(response.body.data.total, 25);
    assert.equal(response.body.data.items.length, 5);
    assert.equal(response.body.data.items[0].boardId, 5);
    assert.equal(response.body.data.sort, "saved-count-desc");
    const alphabetical = await request(app).get("/api/v1/boards/collections/recent?sort=title-desc");
    assert.equal(alphabetical.body.data.items[0].boardId, 1);
    for (const context of ["mine", "saved", "friends"])
        assert.equal((await request(app).get("/api/v1/boards/collections/" + context)).status, 401);
    for (const path of [
        "unknown",
        "profile",
        "category",
        "recent?sort=relevance",
        "recent?sort=saved-at-desc",
        "recent?limit=10",
        "recent?q=x",
        "recent?page=0",
        "recent?handle=someone",
        "map?country=SWE&longitude=0&latitude=0",
        "map?longitude=0"
    ])
        assert.equal(
            (
                await request(app)
                    .get("/api/v1/boards/collections/" + path)
                    .set("x-test-user", "viewer")
            ).status,
            400,
            path
        );
    const own = await request(app).get("/api/v1/boards/collections/mine").set("x-test-user", "owner");
    assert.equal(own.body.data.sort, "updated-desc");
    const empty = await request(app).get("/api/v1/boards/collections/recent?q=unmatched");
    assert.deepEqual(empty.body.data.items, []);
    assert.equal(empty.body.data.total, 0);
});

test("category collections accept bounded OR tags without allowing scope changes or ambiguous tags", async () => {
    const { app, calls } = harness();
    const response = await request(app).get("/api/v1/boards/collections/category?tags=Foodie&tags=Street%20Food");
    assert.equal(response.status, 200);
    assert.deepEqual(calls.context?.tags, ["Foodie", "Street Food"]);
    for (const path of [
        "recent?tags=Foodie",
        "category?tags=",
        "category?tag=Foodie&tags=Culture",
        "category?" + Array.from({ length: 21 }, (_, i) => "tags=tag" + i).join("&")
    ]) {
        assert.equal((await request(app).get("/api/v1/boards/collections/" + path)).status, 400, path);
    }
});

test("destination collection reads are public and require a country or complete coordinate pair", async () => {
    const { app, calls } = harness();
    assert.equal((await request(app).get("/api/v1/boards/collections/destination?country=THA")).status, 200);
    assert.equal(calls.context?.country, "THA");
    assert.equal(
        (await request(app).get("/api/v1/boards/collections/destination?country=THA&latitude=13.7&longitude=100.5"))
            .status,
        200
    );
    assert.equal(calls.context?.latitude, 13.7);
    for (const query of [
        "",
        "latitude=13.7",
        "latitude=13.7&longitude=100.5",
        "country=THA&collection=saved",
        "country=THA&handle=someone"
    ]) {
        assert.equal((await request(app).get("/api/v1/boards/collections/destination?" + query)).status, 400, query);
    }
});
