import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import debug from "debug";
import { Pool } from "pg";

const log = debug("roamboard:db");

export function createPostgresPool(connectionString: string): Pool {
    const pool = new Pool({ connectionString });
    pool.on("error", (error) => log("Idle connection failed: %s", error.message));
    return pool;
}

export async function runMigrations(pool: Pool): Promise<void> {
    const migrations = [
        "001_demo_tables",
        "002_api_quota_usage",
        "003_google_place_references",
        "004_users_and_boards",
        "005_board_creator",
        "006_geoapify_pin_source"
    ];
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY)");
        for (const name of migrations) {
            const applied = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
            if (applied.rowCount === 0) {
                await client.query(await readFile(resolve(`migrations/${name}.sql`), "utf8"));
                await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
            }
        }
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
