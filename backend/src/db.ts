import { Pool } from "pg";

let pool: Pool | undefined;

export async function checkDatabase(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  pool ??= new Pool({ connectionString, connectionTimeoutMillis: 3000 });
  await pool.query("SELECT 1");
}
