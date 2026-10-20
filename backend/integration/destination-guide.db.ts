import "dotenv/config";
import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import test from "node:test";
import { closeDatabase, getPool } from "../src/db.js";
import { createDestinationRepository } from "../src/features/destinations/destination.repository.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

test(
    "destination Boards are public, nearby, unique and stably paginated with ordered photos",
    {
        skip: databaseUrl ? undefined : "TEST_DATABASE_URL or DATABASE_URL is required"
    },
    async (t) => {
        const originalUrl = process.env.DATABASE_URL;
        process.env.DATABASE_URL = databaseUrl;
        const pool = getPool();
        const client = await pool.connect();
        const userId = `destination-guide-test-${randomUUID()}`;
        // Explicit identity values also avoid advancing shared database sequences, which ROLLBACK cannot undo.
        const base = randomInt(1_000_000_000, 1_500_000_000);
        try {
            await client.query("BEGIN");
            await client.query("INSERT INTO app_user (user_id,username,display_name) VALUES ($1,$1,'Guide test')", [
                userId
            ]);
            const category = await client.query<{ type: string }>(
                "SELECT type FROM activity_type ORDER BY type LIMIT 1"
            );
            assert.ok(category.rows[0]);
            const fixtures = [
                { status: "published", visibility: "public", latitude: 80, country: "NOR", time: "2099-01-01" },
                { status: "published", visibility: "public", latitude: 80.2, country: "NOR", time: "2100-01-01" },
                { status: "published", visibility: "public", latitude: 80, country: "Norway", time: "2100-01-01" },
                { status: "published", visibility: "friends", latitude: 80, country: "NOR", time: "2101-01-01" },
                { status: "published", visibility: "collaborators", latitude: 80, country: "NOR", time: "2101-01-01" },
                { status: "draft", visibility: "public", latitude: 80, country: "NOR", time: "2101-01-01" },
                { status: "published", visibility: "public", latitude: 80.3, country: "NOR", time: "2101-01-01" },
                { status: "published", visibility: "public", latitude: 80, country: "SWE", time: "2101-01-01" },
                { status: "published", visibility: "public", latitude: null, country: "NOR", time: "2101-01-01" }
            ];
            for (const [index, fixture] of fixtures.entries()) {
                const id = base + index;
                await client.query(
                    "INSERT INTO board (board_id,owner_user_id,title,status,visibility,updated_at) OVERRIDING SYSTEM VALUE VALUES ($1,$2,'Same-name city walk',$3,$4,$5)",
                    [id, userId, fixture.status, fixture.visibility, fixture.time]
                );
                await client.query(
                    "INSERT INTO board_day (day_id,board_id,day_number) OVERRIDING SYSTEM VALUE VALUES ($1,$1,1)",
                    [id]
                );
                if (fixture.latitude === null) continue;
                await client.query(
                    "INSERT INTO location (location_id,name,latitude,longitude,country,city) OVERRIDING SYSTEM VALUE VALUES ($1,'Station',$2,30,$3,'Same-name city')",
                    [id, fixture.latitude, fixture.country]
                );
                await client.query(
                    "INSERT INTO activity (activity_id,board_id,day_id,day_number,position,title,type,location_id) OVERRIDING SYSTEM VALUE VALUES ($1,$1,$1,1,0,'Station walk',$2,$1)",
                    [id, category.rows[0].type]
                );
            }
            // A second matching activity must not duplicate the first Board in discovery.
            await client.query(
                "INSERT INTO activity (activity_id,board_id,day_id,day_number,position,title,type,location_id) OVERRIDING SYSTEM VALUE VALUES ($1,$2,$2,1,1,'Second station',$3,$2)",
                [base + 20, base, category.rows[0].type]
            );
            for (const index of [0, 1]) {
                await client.query(
                    "INSERT INTO uploaded_image (uploaded_image_id,storage_key,uploaded_by_user_id,uploaded_at) OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,NOW())",
                    [base + index, `${userId}/${index}`, userId]
                );
                await client.query("INSERT INTO board_image (board_id,uploaded_image_id,position) VALUES ($1,$2,$3)", [
                    base + 2,
                    base + index,
                    index
                ]);
            }
            await client.query("UPDATE board SET cover_image_id=$1 WHERE board_id=$2", [base + 1, base + 2]);
            await client.query(
                "UPDATE activity SET external_image_provider='unsplash',external_image_url='https://images.unsplash.com/guide-test',external_image_photographer='Ada',external_image_photographer_url='https://unsplash.com/@ada',external_image_source_url='https://unsplash.com/photos/guide-test' WHERE activity_id=$1",
                [base + 2]
            );
            // Repository calls use this exact transaction client, never a second connection.
            t.mock.method(pool, "query", (sql: string, values: unknown[]) => client.query(sql, values));
            const repository = createDestinationRepository();
            const query = { name: "Same-name city", country: "NOR", latitude: 80, longitude: 30, page: 1, limit: 2 };
            const first = await repository.listPublic(query);
            assert.deepEqual(
                first.boards.map((board) => board.boardId),
                [base + 2, base + 1]
            );
            assert.equal(first.hasMore, true);
            assert.equal(first.boards[0]?.username, userId);
            assert.equal(first.boards[0]?.durationDays, 1);
            assert.deepEqual(
                first.boards[0]?.images.map((image) => image.url),
                [
                    `/api/v1/images/${base + 1}/content?variant=display`,
                    `/api/v1/images/${base}/content?variant=display`,
                    "https://images.unsplash.com/guide-test"
                ]
            );
            assert.equal(first.boards[0]?.images[2]?.photographer, "Ada");
            const second = await repository.listPublic({ ...query, page: 2 });
            assert.deepEqual(
                second.boards.map((board) => board.boardId),
                [base]
            );
            assert.equal(second.hasMore, false);
            assert.deepEqual(second.boards[0]?.activityTitles, ["Station walk", "Second station"]);
            const country = await repository.listPublic({ ...query, name: "Norway", kind: "country", limit: 20 });
            assert.deepEqual(
                country.boards.filter((board) => board.username === userId).map((board) => board.boardId),
                [base + 6, base + 2, base + 1, base]
            );
            // A visibility change is observed on the next read, even with the same city and page.
            await client.query("UPDATE board SET visibility='collaborators' WHERE board_id=$1", [base + 2]);
            const changed = await repository.listPublic(query);
            assert.deepEqual(
                changed.boards.map((board) => board.boardId),
                [base + 1, base]
            );
            assert.equal(changed.hasMore, false);
        } finally {
            try {
                await client.query("ROLLBACK");
                const remaining = await client.query("SELECT user_id FROM app_user WHERE user_id=$1", [userId]);
                assert.equal(remaining.rows.length, 0, "The fixture account must disappear after rollback");
            } finally {
                client.release();
                if (originalUrl === undefined) delete process.env.DATABASE_URL;
                else process.env.DATABASE_URL = originalUrl;
                await closeDatabase();
            }
        }
    }
);
