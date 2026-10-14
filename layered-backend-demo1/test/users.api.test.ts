import assert from "node:assert/strict";
import test from "node:test";

import request from "supertest";

import { createApp } from "../src/app.js";
import { DEMO_USER_ID } from "../src/features/users/user.types.js";

test("reads and updates the seeded prototype profile without allowing username changes", async () => {
    const app = createApp();

    const initial = await request(app).get("/api/v1/users/me");
    assert.equal(initial.status, 200);
    assert.equal(initial.body.data.username, "roam_demo");

    const updated = await request(app)
        .patch("/api/v1/users/me")
        .send({
            displayName: "Changed in the UI",
            description: "This value should persist.",
            location: "Gothenburg, Sweden",
            interests: ["architecture", "coffee"],
            settings: { mapStyle: "satellite" }
        });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.displayName, "Changed in the UI");
    assert.equal(updated.body.data.settings.mapStyle, "satellite");
    assert.equal(updated.body.data.settings.emailUpdates, false);

    const reread = await request(app).get("/api/v1/users/me");
    assert.equal(reread.body.data.description, "This value should persist.");
    assert.equal(reread.body.data.username, "roam_demo");

    const usernameChange = await request(app).patch("/api/v1/users/me").send({ username: "not_allowed" });
    assert.equal(usernameChange.status, 400);
    assert.equal(usernameChange.body.error.code, "REQUEST_FAILED");
});

test("creates a user and selects it through the prototype auth header", async () => {
    const app = createApp();

    const created = await request(app)
        .post("/api/v1/users")
        .send({ username: "new_traveller", displayName: "New Traveller" });
    assert.equal(created.status, 201);

    const selected = await request(app).get("/api/v1/users/me").set("x-demo-user-id", created.body.data.id);
    assert.equal(selected.status, 200);
    assert.equal(selected.body.data.username, "new_traveller");

    const duplicate = await request(app)
        .post("/api/v1/users")
        .send({ username: "NEW_TRAVELLER", displayName: "Duplicate" });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, "USERNAME_TAKEN");
});

test("sets and deletes a profile picture", async () => {
    const app = createApp();
    const setPicture = await request(app)
        .put("/api/v1/users/me/profile-picture")
        .send({ url: "https://images.example/profile.jpg", storageKey: "profiles/demo" });
    assert.equal(setPicture.status, 200);
    assert.equal(setPicture.body.data.profilePicture.storageKey, "profiles/demo");

    const deleted = await request(app).delete("/api/v1/users/me/profile-picture");
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.data.profilePicture, null);
});

test("creates a multi-country Board and updates profile statistics and map destinations", async () => {
    const app = createApp();
    const before = await request(app).get("/api/v1/users/me/stats");

    const created = await request(app)
        .post("/api/v1/users/me/boards")
        .send({
            title: "Lisbon journal",
            visibility: "private",
            isCompleted: true,
            destinations: [
                {
                    country: "Portugal",
                    countryCode: "pt",
                    city: "Lisbon",
                    latitude: 38.7223,
                    longitude: -9.1393
                },
                {
                    country: "Spain",
                    countryCode: "ES",
                    city: "Seville",
                    latitude: 37.3891,
                    longitude: -5.9845
                }
            ]
        });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.ownerId, DEMO_USER_ID);
    assert.equal(created.body.data.destinations[0].countryCode, "PT");
    assert.equal(created.body.data.destinations[1].countryCode, "ES");

    const ownBoards = await request(app).get("/api/v1/users/me/boards?limit=10");
    assert.equal(ownBoards.status, 200);
    assert.ok(ownBoards.body.data.some((board: { id: string }) => board.id === created.body.data.id));

    const after = await request(app).get("/api/v1/users/me/stats");
    assert.equal(after.body.data.boardsCreated, before.body.data.boardsCreated + 1);
    assert.equal(after.body.data.countriesVisited, before.body.data.countriesVisited + 2);

    const map = await request(app).get("/api/v1/users/me/map-destinations");
    assert.ok(map.body.data.some((destination: { countryCode: string }) => destination.countryCode === "PT"));
    assert.ok(map.body.data.some((destination: { countryCode: string }) => destination.countryCode === "ES"));
});

test("records accessible Board visits and supports idempotent saving", async () => {
    const app = createApp();
    const publicBoardId = "10000000-0000-4000-8000-000000000003";

    const board = await request(app).get(`/api/v1/boards/${publicBoardId}`);
    assert.equal(board.status, 200);

    const recent = await request(app).get("/api/v1/users/me/recent-boards");
    assert.equal(recent.status, 200);
    assert.equal(recent.body.data[0].id, publicBoardId);

    const before = await request(app).get("/api/v1/users/me/stats");
    await request(app).put(`/api/v1/users/me/saved-boards/${publicBoardId}`).expect(204);
    await request(app).put(`/api/v1/users/me/saved-boards/${publicBoardId}`).expect(204);
    const after = await request(app).get("/api/v1/users/me/stats");
    assert.equal(after.body.data.boardsSaved, before.body.data.boardsSaved);

    await request(app).delete(`/api/v1/users/me/saved-boards/${publicBoardId}`).expect(204);
    const unsaved = await request(app).get("/api/v1/users/me/stats");
    assert.equal(unsaved.body.data.boardsSaved, before.body.data.boardsSaved - 1);
});

test("rejects malformed prototype identities and Boards without complete destinations", async () => {
    const app = createApp();
    const badIdentity = await request(app).get("/api/v1/users/me").set("x-demo-user-id", "nope");
    assert.equal(badIdentity.status, 401);
    assert.equal(badIdentity.body.error.code, "INVALID_PROTOTYPE_USER");

    const badBoard = await request(app)
        .post("/api/v1/users/me/boards")
        .send({ title: "Bad coordinates", destinations: [{ country: "Sweden", countryCode: "SE", latitude: 59 }] });
    assert.equal(badBoard.status, 400);

    const missingDestination = await request(app)
        .post("/api/v1/users/me/boards")
        .send({ title: "Nowhere", destinations: [] });
    assert.equal(missingDestination.status, 400);

    const missingCity = await request(app)
        .post("/api/v1/users/me/boards")
        .send({
            title: "No city",
            destinations: [{ country: "Sweden", countryCode: "SE", latitude: 59.3293, longitude: 18.0686 }]
        });
    assert.equal(missingCity.status, 400);

    const inventedCountry = await request(app)
        .post("/api/v1/users/me/boards")
        .send({
            title: "Fantasy trip",
            destinations: [{ country: "Narnia", countryCode: "ZZ", city: "Cair Paravel", latitude: 1, longitude: 1 }]
        });
    assert.equal(inventedCountry.status, 400);
});

test("saves incomplete detailed Boards as drafts and validates publishing rules", async () => {
    const app = createApp();
    const dayId = "40000000-0000-4000-8000-000000000001";

    const draft = await request(app)
        .post("/api/v1/boards")
        .send({
            title: "",
            status: "draft",
            visibility: "private",
            tags: ["tokyo", "food"],
            vibes: ["Hidden gems"],
            highlights: [],
            days: [{ id: dayId, dayNumber: 1, date: null, pins: [] }],
            images: []
        });
    assert.equal(draft.status, 201);
    assert.equal(draft.body.data.title, "Untitled Board");
    assert.equal(draft.body.data.status, "draft");

    const invalidPublish = await request(app)
        .post("/api/v1/boards")
        .send({
            title: "Tokyo ideas",
            status: "published",
            visibility: "public",
            tags: [],
            vibes: [],
            highlights: [],
            days: [{ id: dayId, dayNumber: 1, date: null, pins: [] }],
            images: []
        });
    assert.equal(invalidPublish.status, 400);
});

test("creates a public detailed Board with ordered pins and discovery metadata", async () => {
    const indexed: Array<{ id: string; tags: string[]; categories: string[] }> = [];
    const app = createApp({
        boardSearchIndexer: {
            index: async (document) => {
                indexed.push(document);
            }
        }
    });
    const dayId = "40000000-0000-4000-8000-000000000002";
    const pinId = "50000000-0000-4000-8000-000000000001";
    const created = await request(app)
        .post("/api/v1/boards")
        .send({
            title: "A day in Tokyo",
            description: "Temples and noodles.",
            status: "published",
            visibility: "public",
            tags: ["tokyo", "food"],
            vibes: ["Hidden gems", "Solo travel"],
            highlights: ["Senso-ji"],
            days: [
                {
                    id: dayId,
                    dayNumber: 1,
                    date: "2026-10-10",
                    pins: [
                        {
                            id: pinId,
                            order: 0,
                            time: "09:00",
                            title: "Senso-ji",
                            description: "Morning visit",
                            category: "landmark",
                            source: "mapbox",
                            location: {
                                name: "Senso-ji",
                                address: "Asakusa, Tokyo",
                                latitude: 35.7148,
                                longitude: 139.7967,
                                country: "Japan",
                                countryCode: "JP",
                                city: "Tokyo",
                                mapboxId: "mapbox.sensoji"
                            }
                        }
                    ]
                }
            ],
            images: []
        });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.days[0].pins[0].title, "Senso-ji");
    assert.deepEqual(created.body.data.tags, ["tokyo", "food"]);
    assert.deepEqual(created.body.data.vibes, ["Hidden gems", "Solo travel"]);
    assert.equal(created.body.data.destinations[0].countryCode, "JP");
    const inspected = await request(app).get(`/api/v1/boards/${created.body.data.id}`);
    assert.equal(inspected.status, 200);
    assert.equal(inspected.body.data.days[0].pins[0].category, "landmark");
    assert.equal(indexed.length, 1);
    assert.deepEqual(indexed[0]?.tags, ["tokyo", "food"]);
    assert.deepEqual(indexed[0]?.categories, ["Hidden gems", "Solo travel", "landmark"]);
});

function browseBoardInput(
    title: string,
    visibility: "private" | "friends" | "public",
    status: "draft" | "published" = "published"
) {
    return {
        title,
        visibility,
        status,
        tags: ["japan"],
        vibes: ["Culture"],
        highlights: ["Osaka Castle"],
        days: [
            {
                id: "60000000-0000-4000-8000-000000000001",
                dayNumber: 1,
                date: null,
                pins: [
                    {
                        id: "60000000-0000-4000-8000-000000000002",
                        order: 0,
                        time: "09:00",
                        title: "Osaka Castle",
                        category: "landmark",
                        source: "mapbox",
                        description: "Castle visit",
                        location: {
                            name: "Osaka Castle",
                            address: "Osaka, Japan",
                            latitude: 34.6873,
                            longitude: 135.5262,
                            country: "Japan",
                            countryCode: "JP",
                            city: "Osaka",
                            mapboxId: "osaka-castle"
                        }
                    }
                ]
            }
        ],
        images: []
    };
}

test("browse includes own drafts and only published public or accepted-friend Boards from others", async () => {
    const app = createApp();
    const friend = "00000000-0000-4000-8000-000000000002";
    const stranger = await request(app)
        .post("/api/v1/users")
        .send({ username: "browse_stranger", displayName: "Stranger" })
        .expect(201);
    const create = async (
        owner: string,
        title: string,
        visibility: "private" | "friends" | "public",
        status: "draft" | "published" = "published"
    ) => {
        const result = await request(app)
            .post("/api/v1/boards")
            .set("x-demo-user-id", owner)
            .send(browseBoardInput(title, visibility, status))
            .expect(201);
        return result.body.data.id as string;
    };
    const visible = [
        await create(DEMO_USER_ID, "Own private draft", "private", "draft"),
        await create(DEMO_USER_ID, "Own public draft", "public", "draft"),
        await create(friend, "Friend published", "friends"),
        await create(stranger.body.data.id, "Stranger published", "public")
    ];
    const hidden = [
        await create(friend, "Friend private", "private"),
        await create(friend, "Friend public draft", "public", "draft"),
        await create(stranger.body.data.id, "Stranger friends", "friends"),
        await create(stranger.body.data.id, "Stranger private", "private"),
        await create(stranger.body.data.id, "Stranger public draft", "public", "draft")
    ];
    const result = await request(app).get("/api/v1/boards?page=1&limit=20").expect(200);
    assert.deepEqual(result.body.meta, { page: 1, limit: 20, hasMore: false });
    const ids = result.body.data.map((board: { id: string }) => board.id);
    for (const id of visible) assert.ok(ids.includes(id), `Missing accessible Board ${id}`);
    for (const id of hidden) assert.ok(!ids.includes(id), `Leaked inaccessible Board ${id}`);
    const publicDraft = await request(app).get(`/api/v1/boards/${hidden[1]}`);
    assert.equal(publicDraft.status, 404);
});

test("browse paginates without duplicate Boards and validates pagination and identity", async () => {
    const app = createApp();
    await request(app)
        .post("/api/v1/boards")
        .send(browseBoardInput("Pagination draft", "private", "draft"))
        .expect(201);
    const whole = await request(app).get("/api/v1/boards").expect(200);
    assert.equal(whole.body.meta.page, 1);
    assert.equal(whole.body.meta.limit, 20);
    const pages = await Promise.all(
        whole.body.data.map((_board: unknown, index: number) =>
            request(app)
                .get(`/api/v1/boards?page=${index + 1}&limit=1`)
                .expect(200)
        )
    );
    assert.deepEqual(
        pages.flatMap((page) => page.body.data.map((board: { id: string }) => board.id)),
        whole.body.data.map((board: { id: string }) => board.id)
    );
    pages.forEach((page, index) =>
        assert.deepEqual(page.body.meta, { page: index + 1, limit: 1, hasMore: index < pages.length - 1 })
    );
    const empty = await request(app)
        .get(`/api/v1/boards?page=${pages.length + 1}&limit=1`)
        .expect(200);
    assert.deepEqual(empty.body.data, []);
    assert.equal(empty.body.meta.hasMore, false);
    for (const query of [
        "page=0",
        "page=-1",
        "page=1.5",
        "page=nope",
        "limit=0",
        "limit=51",
        "limit=1.5",
        "unexpected=true"
    ]) {
        await request(app).get(`/api/v1/boards?${query}`).expect(400);
    }
    await request(app).get("/api/v1/boards").set("x-demo-user-id", "00000000-0000-4000-8000-000000000099").expect(401);
});

test("delete permits only the owner and hides missing or inaccessible Boards", async () => {
    const app = createApp();
    const friend = "00000000-0000-4000-8000-000000000002";
    const publicBoard = await request(app)
        .post("/api/v1/boards")
        .set("x-demo-user-id", friend)
        .send(browseBoardInput("Readable other Board", "public"))
        .expect(201);
    const privateBoard = await request(app)
        .post("/api/v1/boards")
        .set("x-demo-user-id", friend)
        .send(browseBoardInput("Hidden other Board", "private"))
        .expect(201);
    await request(app).delete(`/api/v1/boards/${publicBoard.body.data.id}`).expect(403);
    await request(app).delete(`/api/v1/boards/${privateBoard.body.data.id}`).expect(404);
    await request(app).delete("/api/v1/boards/70000000-0000-4000-8000-000000000099").expect(404);
    await request(app).delete("/api/v1/boards/not-a-uuid").expect(400);
    await request(app)
        .delete(`/api/v1/boards/${publicBoard.body.data.id}`)
        .set("x-demo-user-id", "00000000-0000-4000-8000-000000000099")
        .expect(401);
    await request(app).get(`/api/v1/boards/${publicBoard.body.data.id}`).expect(200);
});

test("owner deletion removes Board details, saved references, visits, map destinations and search entry", async () => {
    const indexed: string[] = [];
    const removed: string[] = [];
    const app = createApp({
        boardSearchIndexer: {
            index: async (document) => {
                indexed.push(document.id);
            },
            remove: async (boardId) => {
                removed.push(boardId);
            }
        }
    });
    const created = await request(app)
        .post("/api/v1/boards")
        .send(browseBoardInput("Delete complete itinerary", "public"))
        .expect(201);
    const id: string = created.body.data.id;
    const friend = "00000000-0000-4000-8000-000000000002";
    await request(app).get(`/api/v1/boards/${id}`).set("x-demo-user-id", friend).expect(200);
    await request(app).put(`/api/v1/users/me/saved-boards/${id}`).set("x-demo-user-id", friend).expect(204);
    const ownerBefore = await request(app).get("/api/v1/users/me/stats").expect(200);
    const friendBefore = await request(app).get("/api/v1/users/me/stats").set("x-demo-user-id", friend).expect(200);
    assert.ok(indexed.includes(id));
    const deleted = await request(app).delete(`/api/v1/boards/${id}`).expect(204);
    assert.equal(deleted.text, "");
    assert.deepEqual(removed, [id]);
    await request(app).get(`/api/v1/boards/${id}`).expect(404);
    await request(app).delete(`/api/v1/boards/${id}`).expect(404);
    assert.deepEqual(removed, [id]);
    const ownerAfter = await request(app).get("/api/v1/users/me/stats").expect(200);
    const friendAfter = await request(app).get("/api/v1/users/me/stats").set("x-demo-user-id", friend).expect(200);
    assert.equal(ownerAfter.body.data.boardsCreated, ownerBefore.body.data.boardsCreated - 1);
    assert.equal(friendAfter.body.data.boardsSaved, friendBefore.body.data.boardsSaved - 1);
    for (const path of ["/api/v1/boards", "/api/v1/users/me/boards", "/api/v1/users/me/map-destinations"]) {
        const result = await request(app).get(path).expect(200);
        assert.ok(
            !result.body.data.some(
                (entry: { id?: string; boardId?: string }) => entry.id === id || entry.boardId === id
            )
        );
    }
    const recent = await request(app).get("/api/v1/users/me/recent-boards").set("x-demo-user-id", friend).expect(200);
    assert.ok(!recent.body.data.some((entry: { id: string }) => entry.id === id));
    await request(app).put(`/api/v1/users/me/saved-boards/${id}`).set("x-demo-user-id", friend).expect(404);
});

test("stores and reads a Geoapify event pin as a timed day plan", async () => {
    const app = createApp();
    const created = await request(app)
        .post("/api/v1/boards")
        .send({
            title: "Copenhagen day plan",
            status: "published",
            visibility: "public",
            tags: [],
            vibes: [],
            highlights: [],
            images: [],
            days: [
                {
                    id: "70000000-0000-4000-8000-000000000001",
                    dayNumber: 1,
                    date: "2026-10-10",
                    pins: [
                        {
                            id: "70000000-0000-4000-8000-000000000002",
                            order: 0,
                            time: "09:00",
                            title: "Morning concert",
                            description: "Meet by the venue",
                            category: "event",
                            source: "geoapify",
                            location: {
                                name: "Copenhagen",
                                address: "Copenhagen, Denmark",
                                latitude: 55.6761,
                                longitude: 12.5683,
                                country: "Denmark",
                                countryCode: "DK",
                                city: "Copenhagen",
                                mapboxId: "geoapify-copenhagen"
                            }
                        }
                    ]
                }
            ]
        });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const read = await request(app).get(`/api/v1/boards/${created.body.data.id}`);
    assert.equal(read.status, 200);
    const day = read.body.data.days[0];
    assert.equal(day.dayNumber, 1);
    assert.equal(day.date, "2026-10-10");
    assert.equal(day.pins[0].source, "geoapify");
    assert.equal(day.pins[0].category, "event");
    assert.equal(day.pins[0].time, "09:00");
    assert.equal(day.pins[0].location.mapboxId, "geoapify-copenhagen");
    assert.equal(day.pins[0].location.latitude, 55.6761);
    assert.equal(read.body.data.destinations[0].countryCode, "DK");
});
