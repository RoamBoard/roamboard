import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { closeDatabase, getPool } from "../src/db.js";
import { createSavedPlacesRepository } from "../src/features/saved-places/saved-places.repository.js";
import type { PlaceInput } from "../src/features/saved-places/saved-places.types.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

test(
    "saved places persist once per account and repository reads and deletes remain account-scoped",
    {
        skip: databaseUrl ? undefined : "TEST_DATABASE_URL or DATABASE_URL is required"
    },
    async (t) => {
        const originalUrl = process.env.DATABASE_URL;
        process.env.DATABASE_URL = databaseUrl;
        const pool = getPool();
        const client = await pool.connect();
        const schema = `rb_saved_places_${randomBytes(6).toString("hex")}`;
        try {
            await client.query("BEGIN");
            await client.query(`CREATE SCHEMA ${schema}`);
            await client.query(`SET LOCAL search_path TO ${schema}`);
            // Apply the real table definitions only inside this transaction's disposable schema.
            for (const filename of ["001_initial.sql", "008_saved_places.sql"]) {
                await client.query(await readFile(new URL(`../db/migrations/${filename}`, import.meta.url), "utf8"));
            }
            await client.query(
                "INSERT INTO app_user (user_id,username,display_name) VALUES ('a','traveller_a','A'),('b','traveller_b','B')"
            );
            t.mock.method(pool, "query", (sql: string, values: unknown[]) => client.query(sql, values));
            const repository = createSavedPlacesRepository();
            const place: PlaceInput = {
                id: "geoapify:station/42",
                name: "Central station",
                address: "Centralplan 15",
                latitude: 59.33,
                longitude: 18.058,
                city: "Stockholm",
                country: "SWE"
            };
            const first = await repository.save("a", place);
            assert.deepEqual(first, { ...place, savedAt: first.savedAt });
            assert.match(first.savedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            const revised = {
                ...place,
                name: "West entrance",
                address: "New address",
                latitude: 59.331,
                longitude: 18.059
            };
            await repository.save("a", revised);
            await repository.save("b", { ...place, name: "B's own saved name" });
            // A fresh repository instance must read persisted values, including numeric coordinates.
            const persisted = await createSavedPlacesRepository().list("a");
            assert.equal(persisted.length, 1);
            assert.deepEqual(persisted[0], { ...revised, savedAt: persisted[0]!.savedAt });
            assert.deepEqual(
                (await repository.list("b")).map((row) => row.name),
                ["B's own saved name"]
            );
            await client.query(
                "UPDATE saved_place SET saved_at='2000-01-01T00:00:00Z' WHERE user_id='a' AND place_id=$1",
                [place.id]
            );
            await repository.save("a", { ...place, id: "geoapify:museum/43", name: "Museum", address: "" });
            assert.deepEqual(
                (await repository.list("a")).map((row) => row.name),
                ["Museum", "West entrance"]
            );
            await repository.remove("a", place.id);
            await repository.remove("a", place.id);
            assert.deepEqual(
                (await repository.list("a")).map((row) => row.name),
                ["Museum"]
            );
            assert.deepEqual(
                (await repository.list("b")).map((row) => row.name),
                ["B's own saved name"]
            );
            const stored = await client.query("SELECT user_id,place_id FROM saved_place ORDER BY user_id,place_id");
            assert.deepEqual(stored.rows, [
                { user_id: "a", place_id: "geoapify:museum/43" },
                { user_id: "b", place_id: place.id }
            ]);
        } finally {
            try {
                await client.query("ROLLBACK");
                const remaining = await client.query(
                    "SELECT schema_name FROM information_schema.schemata WHERE schema_name=$1",
                    [schema]
                );
                assert.equal(
                    remaining.rows.length,
                    0,
                    "The test schema and all fixture rows must disappear after rollback"
                );
            } finally {
                client.release();
                if (originalUrl === undefined) delete process.env.DATABASE_URL;
                else process.env.DATABASE_URL = originalUrl;
                await closeDatabase();
            }
        }
    }
);
