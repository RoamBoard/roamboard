import "dotenv/config";

import { readFileSync, existsSync } from "node:fs";
import { parse } from "dotenv";

import { closeDatabase, getPool } from "../db.js";

function report(ok: boolean, message: string): void {
    process.stdout.write(`${ok ? "OK" : "FAIL"} ${message}\n`);
    if (!ok) process.exitCode = 1;
}

const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
report(
    Boolean(clientId && !clientId.startsWith("your-")),
    "GOOGLE_CLIENT_ID must contain the team's Google web client ID."
);
report(
    Boolean(process.env.CLIENT_ORIGIN),
    "CLIENT_ORIGIN must match the frontend origin (http://localhost:3000 locally)."
);

if (existsSync("../frontend/.env.local")) {
    const frontend = parse(readFileSync("../frontend/.env.local"));
    report(
        Boolean(clientId && clientId === frontend.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
        "Backend GOOGLE_CLIENT_ID and frontend NEXT_PUBLIC_GOOGLE_CLIENT_ID must match."
    );
}

try {
    await getPool().query("SELECT 1");
    report(true, "Database connection works with this backend's DATABASE_URL.");
    await getPool().query("SELECT user_id, username, display_name FROM app_user LIMIT 0");
    await getPool().query("SELECT token_hash, user_id, expires_at FROM auth_session LIMIT 0");
    await getPool().query("SELECT revision, status, updated_at FROM board LIMIT 0");
    await getPool().query("SELECT created_at, updated_at FROM app_user LIMIT 0");
    await getPool().query("SELECT policy_id, window_name FROM api_quota_usage LIMIT 0");
    await getPool().query("SELECT user_id, place_id FROM google_place_reference LIMIT 0");
    report(true, "Board and API feature migrations 003 and 004 exist.");
    const quotaKey = await getPool().query<{ compact: boolean }>(
        `SELECT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'api_quota_usage'::regclass AND contype = 'p'
              AND pg_get_constraintdef(oid) = 'PRIMARY KEY (policy_id, window_name)'
        ) AS compact`
    );
    report(quotaKey.rows[0]?.compact === true, "API migration 004 has the compact policy/window primary key.");
    await getPool().query("SELECT previous_used, previous_window_end FROM api_quota_usage LIMIT 0");
    report(true, "API migration 004 has previous-window quota fields.");
    const permissions = await getPool().query<{ writable: boolean }>(
        `SELECT has_table_privilege(current_user, 'app_user', 'INSERT')
            AND has_table_privilege(current_user, 'auth_session', 'INSERT')
            AND has_table_privilege(current_user, 'auth_session', 'DELETE') AS writable`
    );
    report(
        permissions.rows[0]?.writable === true,
        "Authentication tables exist and the role has session write access."
    );
} catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
    report(
        false,
        `Database/schema check failed (${code}). Check the SSH tunnel, DATABASE_URL, and applied migrations.`
    );
} finally {
    await closeDatabase();
}
