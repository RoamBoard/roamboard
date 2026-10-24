import "dotenv/config";
import { mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { closeDatabase, getPool } from "../db.js";

// Applies only migration 022, once, after a verified local custom-format backup.
// No connection string or credentials are written to output or passed as CLI arguments.
async function apply() {
    const pool = getPool();
    const current = await pool.query<{ present: string | null }>(
        "SELECT column_name AS present FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='activity' AND column_name='external_image_context'"
    );
    if (current.rows[0]?.present) {
        process.stdout.write("Activity photo context migration is already present; nothing applied.\n");
        return;
    }
    await pool.query("SELECT presentation_edit, presentation_revision FROM uploaded_image LIMIT 0");
    await pool.query("SELECT comment_id FROM board_comment LIMIT 0");

    if (!process.argv.includes("--apply")) {
        process.stdout.write(
            "Activity photo context migration is pending. Use --apply to back up and apply only 022.\n"
        );
        return;
    }
    const connection = new URL(process.env.DATABASE_URL!);
    const backups = new URL("../../backups/", import.meta.url);
    await mkdir(backups, { recursive: true });
    const backup = fileURLToPath(new URL(`pre-022-${new Date().toISOString().replace(/[:.]/g, "")}.dump`, backups));
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
    const sql = await readFile(new URL("../../db/migrations/022_activity_photo_context.sql", import.meta.url), "utf8");
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(160022)");
        const check = await client.query(
            "SELECT column_name AS present FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='activity' AND column_name='external_image_context'"
        );
        if (check.rows[0]?.present)
            throw new Error("Another maintainer applied Activity photo context; no migration repeated.");
        await client.query(sql);
        await client.query("COMMIT");
        process.stdout.write(`Applied 022_activity_photo_context.sql. Verified backup: ${backup}\n`);
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
