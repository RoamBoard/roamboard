import "dotenv/config";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { closeDatabase, getPool } from "../db.js";

const presentSql = "SELECT to_regclass(current_schema() || '.account_asset_cleanup') IS NOT NULL AS present";

async function apply() {
    const pool = getPool();
    const current = await pool.query<{ present: boolean }>(presentSql);
    if (current.rows[0]?.present) {
        process.stdout.write("Account deletion migration is already present; nothing applied.\n");
        return;
    }
    await pool.query("SELECT uploaded_image_id FROM activity_image LIMIT 0");
    await pool.query("SELECT deletion_requested_at FROM uploaded_image LIMIT 0");

    if (!process.argv.includes("--apply")) {
        process.stdout.write("Account deletion migration is pending. Use --apply to back up and apply only 025.\n");
        return;
    }
    const connection = new URL(process.env.DATABASE_URL!);
    const backups = new URL("../../backups/", import.meta.url);
    await mkdir(backups, { recursive: true });
    const backup = fileURLToPath(new URL(`pre-025-${new Date().toISOString().replace(/[:.]/g, "")}.dump`, backups));
    const bin =
        process.platform === "win32" && existsSync("C:/Program Files/PostgreSQL/18/bin/pg_dump.exe")
            ? "C:/Program Files/PostgreSQL/18/bin/"
            : "";
    const env = {
        ...process.env,
        PGHOST: connection.hostname,
        PGPORT: connection.port || "5432",
        PGUSER: decodeURIComponent(connection.username),
        PGPASSWORD: decodeURIComponent(connection.password),
        PGDATABASE: decodeURIComponent(connection.pathname.slice(1)),
        ...(connection.searchParams.has("sslmode") ? { PGSSLMODE: connection.searchParams.get("sslmode")! } : {})
    };
    const dump = spawnSync(`${bin}pg_dump`, ["--format=custom", "--file", backup], { env, windowsHide: true });
    if (dump.status !== 0) throw new Error("Database backup failed; migration was not applied.");
    const listing = spawnSync(`${bin}pg_restore`, ["--list", backup], { env, windowsHide: true });
    if (listing.status !== 0 || !listing.stdout.includes(Buffer.from("TABLE DATA")))
        throw new Error("Backup archive verification failed; migration was not applied.");

    const sql = await readFile(new URL("../../db/migrations/025_delete_account.sql", import.meta.url), "utf8");
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(160025)");
        const check = await client.query<{ present: boolean }>(presentSql);
        if (check.rows[0]?.present)
            throw new Error("Another maintainer applied account deletion; no migration repeated.");
        await client.query(sql);
        await client.query("COMMIT");
        process.stdout.write(`Applied 025_delete_account.sql. Verified backup: ${backup}\n`);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

apply()
    .catch((error: unknown) => {
        process.stderr.write(`${error instanceof Error ? error.message : "Migration failed"}\n`);
        process.exitCode = 1;
    })
    .finally(closeDatabase);
