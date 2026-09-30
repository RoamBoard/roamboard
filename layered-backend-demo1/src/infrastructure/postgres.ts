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
  const sql = await readFile(resolve("migrations/001_demo_tables.sql"), "utf8");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY)");
    const applied = await client.query(
      "SELECT 1 FROM schema_migrations WHERE name = $1",
      ["001_demo_tables"],
    );
    if (applied.rowCount === 0) {
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (name) VALUES ($1)",
        ["001_demo_tables"],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
