import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import request from "supertest";

import { createApp } from "../src/app.js";
import { sampleSearchDocuments } from "../src/features/search/search.documents.js";
import { createSearchModule } from "../src/features/search/search.module.js";
import {
    createPostgresSearchSourceRepository,
    seedSearchDocuments
} from "../src/features/search/search.postgres-repository.js";
import { createPostgresTodoRepository } from "../src/features/todos/todo.postgres-repository.js";
import { createPostgresPool, runMigrations } from "../src/infrastructure/postgres.js";

const runIntegration = process.env.RUN_POSTGRES_INTEGRATION === "1";

test("PostgreSQL persists API todos and supplies database search records", { skip: !runIntegration }, async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL;
    assert.ok(databaseUrl, "Set TEST_DATABASE_URL for the PostgreSQL integration test");

    const pool = createPostgresPool(databaseUrl);
    const createdIds: string[] = [];
    const privateDocumentId = `private-integration-${randomUUID()}`;

    try {
        await runMigrations(pool);
        await seedSearchDocuments(pool, sampleSearchDocuments);
        const sample = sampleSearchDocuments[0];
        assert.ok(sample);
        await pool.query("INSERT INTO search_documents (id, document) VALUES ($1, $2::jsonb)", [
            privateDocumentId,
            JSON.stringify({
                ...sample,
                id: privateDocumentId,
                title: "Private Alpine Hideout",
                titleSuggest: "Private Alpine Hideout",
                isPublic: false
            })
        ]);
        const sourceRepository = createPostgresSearchSourceRepository(pool);
        const searchModule = createSearchModule({ sourceRepository });
        assert.ok((await searchModule.service.reindex()) >= sampleSearchDocuments.length);

        const repository = createPostgresTodoRepository(pool);
        const app = createApp({ todoRepository: repository, searchModule });
        const created = await request(app).post("/api/v1/todos").send({ title: "PostgreSQL integration check" });
        assert.equal(created.status, 201);
        const todoId: string = created.body.data.id;
        createdIds.push(todoId);

        const secondApp = createApp({ todoRepository: createPostgresTodoRepository(pool), searchModule });
        const persisted = await request(secondApp).get(`/api/v1/todos/${todoId}`);
        assert.equal(persisted.status, 200);
        assert.equal(persisted.body.data.title, "PostgreSQL integration check");

        const search = await request(secondApp).get("/api/v1/search?q=stokholm");
        assert.equal(search.status, 200);
        assert.ok(
            search.body.data.hits.some((hit: { document: { title: string } }) => hit.document.title === "Stockholm")
        );

        const privateSearch = await request(secondApp).get("/api/v1/search?q=Private%20Alpine%20Hideout");
        assert.equal(privateSearch.status, 200);
        assert.equal(privateSearch.body.data.hits.length, 0);
    } finally {
        for (const id of createdIds) {
            await pool.query("DELETE FROM todos WHERE id = $1", [id]);
        }
        await pool.query("DELETE FROM search_documents WHERE id = $1", [privateDocumentId]);
        await pool.end();
    }
});

test(
    "PostgreSQL owner deletion cascades itinerary children and durable search source",
    { skip: !runIntegration },
    async () => {
        const databaseUrl = process.env.TEST_DATABASE_URL;
        assert.ok(databaseUrl, "Set TEST_DATABASE_URL for the PostgreSQL integration test");
        const pool = createPostgresPool(databaseUrl);
        const ownerIds: string[] = [];
        const boardIds: string[] = [];
        try {
            await runMigrations(pool);
            const { createPostgresUserRepository } = await import("../src/features/users/user.postgres-repository.js");
            const app = createApp({ userRepository: createPostgresUserRepository(pool) });
            const owner = await request(app)
                .post("/api/v1/users")
                .send({
                    username: `del_${randomUUID().replaceAll("-", "").slice(0, 20)}`,
                    displayName: "Deletion integration"
                })
                .expect(201);
            ownerIds.push(owner.body.data.id);
            const dayId = randomUUID();
            const pinId = randomUUID();
            const imageId = randomUUID();
            const created = await request(app)
                .post("/api/v1/boards")
                .set("x-demo-user-id", owner.body.data.id)
                .send({
                    title: "Durable deletion",
                    status: "published",
                    visibility: "public",
                    tags: ["castle"],
                    vibes: [],
                    highlights: ["Osaka Castle"],
                    days: [
                        {
                            id: dayId,
                            dayNumber: 1,
                            date: null,
                            pins: [
                                {
                                    id: pinId,
                                    order: 0,
                                    time: "09:00",
                                    title: "Osaka Castle",
                                    description: "",
                                    category: "landmark",
                                    source: "mapbox",
                                    location: {
                                        name: "Osaka Castle",
                                        address: "Osaka, Japan",
                                        latitude: 34.6873,
                                        longitude: 135.5262,
                                        country: "Japan",
                                        countryCode: "JP",
                                        city: "Osaka",
                                        mapboxId: "integration-osaka"
                                    }
                                }
                            ]
                        }
                    ],
                    images: [
                        {
                            id: imageId,
                            pinId,
                            publicId: `integration/${imageId}`,
                            source: "upload",
                            url: "https://images.example/castle.jpg",
                            thumbnailUrl: "https://images.example/castle-thumb.jpg",
                            width: 100,
                            height: 100,
                            capturedAt: null,
                            latitude: null,
                            longitude: null,
                            order: 0,
                            credit: null,
                            creditUrl: null,
                            sourceUrl: null
                        }
                    ]
                })
                .expect(201);
            const boardId: string = created.body.data.id;
            boardIds.push(boardId);
            await request(app).get(`/api/v1/boards/${boardId}`).set("x-demo-user-id", owner.body.data.id).expect(200);
            await request(app)
                .put(`/api/v1/users/me/saved-boards/${boardId}`)
                .set("x-demo-user-id", owner.body.data.id)
                .expect(204);
            const tables = [
                "board_destinations",
                "board_days",
                "board_pins",
                "board_images",
                "board_visits",
                "saved_boards"
            ];
            for (const table of tables) {
                const rows = await pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE board_id = $1`, [
                    boardId
                ]);
                assert.ok(rows.rows[0].count > 0, `Expected ${table} fixture before deletion`);
            }
            assert.equal(
                (await pool.query("SELECT count(*)::int AS count FROM search_documents WHERE id = $1", [boardId]))
                    .rows[0].count,
                1
            );
            await request(app)
                .delete(`/api/v1/boards/${boardId}`)
                .set("x-demo-user-id", owner.body.data.id)
                .expect(204);
            for (const table of tables) {
                assert.equal(
                    (await pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE board_id = $1`, [boardId]))
                        .rows[0].count,
                    0,
                    `${table} survived deletion`
                );
            }
            assert.equal(
                (await pool.query("SELECT count(*)::int AS count FROM search_documents WHERE id = $1", [boardId]))
                    .rows[0].count,
                0
            );
            const restartedApp = createApp({ userRepository: createPostgresUserRepository(pool) });
            await request(restartedApp)
                .get(`/api/v1/boards/${boardId}`)
                .set("x-demo-user-id", owner.body.data.id)
                .expect(404);
        } finally {
            for (const id of boardIds) {
                await pool.query("DELETE FROM search_documents WHERE id = $1", [id]);
                await pool.query("DELETE FROM boards WHERE id = $1", [id]);
            }
            for (const id of ownerIds) await pool.query("DELETE FROM users WHERE id = $1", [id]);
            await pool.end();
        }
    }
);

test(
    "PostgreSQL migration permits Geoapify event pins and retains them across app instances",
    { skip: !runIntegration },
    async () => {
        const databaseUrl = process.env.TEST_DATABASE_URL;
        assert.ok(databaseUrl, "Set TEST_DATABASE_URL for the PostgreSQL integration test");
        const pool = createPostgresPool(databaseUrl);
        const state: { ownerId?: string } = {};
        try {
            await runMigrations(pool);
            const { createPostgresUserRepository } = await import("../src/features/users/user.postgres-repository.js");
            const app = createApp({ userRepository: createPostgresUserRepository(pool) });
            const owner = await request(app)
                .post("/api/v1/users")
                .send({
                    username: `geo_${randomUUID().replaceAll("-", "").slice(0, 20)}`,
                    displayName: "Geoapify integration"
                })
                .expect(201);
            state.ownerId = owner.body.data.id;
            const created = await request(app)
                .post("/api/v1/boards")
                .set("x-demo-user-id", state.ownerId!)
                .send({
                    title: "Durable Geoapify day plan",
                    status: "published",
                    visibility: "public",
                    tags: [],
                    vibes: [],
                    highlights: [],
                    images: [],
                    days: [
                        {
                            id: randomUUID(),
                            dayNumber: 1,
                            date: "2026-10-10",
                            pins: [
                                {
                                    id: randomUUID(),
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
                                        mapboxId: "geoapify:copenhagen"
                                    }
                                }
                            ]
                        }
                    ]
                })
                .expect(201);
            const secondApp = createApp({ userRepository: createPostgresUserRepository(pool) });
            const persisted = await request(secondApp).get(`/api/v1/boards/${created.body.data.id}`).expect(200);
            const pin = persisted.body.data.days[0].pins[0];
            assert.equal(pin.source, "geoapify");
            assert.equal(pin.location.mapboxId, "geoapify:copenhagen");
            assert.equal(pin.time, "09:00");
            assert.equal(pin.category, "event");
        } finally {
            if (state.ownerId) await pool.query("DELETE FROM users WHERE id = $1", [state.ownerId]);
            await pool.end();
        }
    }
);
