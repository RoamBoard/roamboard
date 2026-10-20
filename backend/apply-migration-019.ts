import "dotenv/config";
import { readFile } from "node:fs/promises";
import { getPool, closeDatabase } from "./src/db.js";

async function run() {
    const pool = getPool();
    const before = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM language");
    console.log("Language count before migration:", before.rows[0]?.count);

    const sql = await readFile("./db/migrations/019_add_spoken_languages.sql", "utf8");
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("COMMIT");
        console.log("Successfully applied 019_add_spoken_languages.sql");
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Migration failed, rolled back:", err);
        throw err;
    } finally {
        client.release();
    }

    const after = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM language");
    console.log("Language count after migration:", after.rows[0]?.count);
}

run().catch((e) => {
    console.error(e);
    process.exitCode = 1;
}).finally(closeDatabase);

