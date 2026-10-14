import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error("DATABASE_URL is not configured");
    }

    pool ??= new Pool({ connectionString, connectionTimeoutMillis: 3000 });
    return pool;
}

export async function checkDatabase(): Promise<void> {
    await getPool().query("SELECT 1");
}

export async function closeDatabase(): Promise<void> {
    if (pool) {
        const current = pool;
        pool = undefined;
        await current.end();
    }
}
