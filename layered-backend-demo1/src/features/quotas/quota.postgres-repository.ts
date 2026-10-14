import type { Pool } from "pg";

import type {
    QuotaRepository,
    QuotaReservationResult,
    QuotaReservationWindow,
    QuotaUsageWindow
} from "./quota.types.js";

interface UsageRow {
    used: string;
}

function toUsageWindow(window: QuotaReservationWindow, used: number): QuotaUsageWindow {
    return {
        name: window.name,
        period: window.period,
        limit: window.limit,
        used,
        remaining: Math.max(0, window.limit - used),
        startsAt: window.startsAt.toISOString(),
        resetsAt: window.endsAt.toISOString(),
        timeZone: window.timeZone
    };
}

export function createPostgresQuotaRepository(pool: Pool): QuotaRepository {
    const cleanup = { dueAt: 0 };
    async function currentUsage(policyId: string, window: QuotaReservationWindow): Promise<number> {
        const result = await pool.query<UsageRow>(
            `SELECT used FROM api_quota_usage WHERE policy_id = $1 AND window_name = $2 AND window_start = $3`,
            [policyId, window.name, window.startsAt]
        );
        return Number(result.rows[0]?.used ?? 0);
    }

    return {
        durable: true,
        reserve: async (policyId, units, windows): Promise<QuotaReservationResult> => {
            if (Date.now() >= cleanup.dueAt) {
                await pool.query("DELETE FROM api_quota_usage WHERE window_end < now() - interval '31 days'");
                cleanup.dueAt = Date.now() + 60 * 60 * 1000;
            }
            const client = await pool.connect();
            try {
                await client.query("BEGIN");
                for (const window of windows) {
                    const result = await client.query<UsageRow>(
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
                        const usage = await client.query<UsageRow>(
                            "SELECT used FROM api_quota_usage WHERE policy_id = $1 AND window_name = $2 AND window_start = $3",
                            [policyId, window.name, window.startsAt]
                        );
                        const used = Number(usage.rows[0]?.used ?? 0);
                        return { allowed: false, blocked: toUsageWindow(window, used) };
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
        },
        usage: async (policyId, windows) => Promise.all(windows.map((window) => currentUsage(policyId, window)))
    };
}
