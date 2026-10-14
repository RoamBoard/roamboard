import { getPool } from "../../db.js";
import type { QuotaRepository } from "./quota.types.js";

export function createPostgresQuotaRepository(): QuotaRepository {
    const cleanup = { dueAt: 0 };
    return {
        reserve: async (policyId, units, windows): Promise<{ allowed: boolean }> => {
            if (Date.now() >= cleanup.dueAt) {
                await getPool().query("DELETE FROM api_quota_usage WHERE window_end < now() - interval '31 days'");
                cleanup.dueAt = Date.now() + 60 * 60 * 1000;
            }
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                for (const window of windows) {
                    const result = await client.query(
                        `INSERT INTO api_quota_usage (policy_id, window_name, window_start, window_end, used)
             SELECT $1, $2, $3, $4, $5::bigint WHERE $5::bigint <= $6::bigint
             ON CONFLICT (policy_id, window_name, window_start)
             DO UPDATE SET used = api_quota_usage.used + EXCLUDED.used
             WHERE api_quota_usage.used + EXCLUDED.used <= $6::bigint
             RETURNING used`,
                        [policyId, window.name, window.startsAt, window.endsAt, units, window.limit]
                    );
                    if (result.rowCount === 0) {
                        await client.query("ROLLBACK");
                        return { allowed: false };
                    }
                }
                await client.query("COMMIT");
                return { allowed: true };
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        }
    };
}
