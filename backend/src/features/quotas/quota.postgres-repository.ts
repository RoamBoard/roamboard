import { getPool } from "../../db.js";
import type { QuotaRepository } from "./quota.types.js";

interface CounterRow {
    window_start: Date;
    window_end: Date;
    used: string;
    previous_used: string;
    previous_window_end: Date | null;
}

export function createPostgresQuotaRepository(): QuotaRepository {
    return {
        async block(policyId, until) {
            await getPool().query(
                `INSERT INTO api_quota_usage (policy_id, window_name, window_start, window_end, used)
                 VALUES ($1, 'provider:cooldown', '-infinity', $2, 0)
                 ON CONFLICT (policy_id, window_name) DO UPDATE
                 SET window_end = GREATEST(api_quota_usage.window_end, EXCLUDED.window_end)`,
                [policyId, until]
            );
        },
        async reserve(policyId, units, windows) {
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                // A shared policy lock serializes reservations and provider feedback.
                await client.query(
                    `INSERT INTO api_quota_usage (policy_id, window_name, window_start, window_end, used)
                     VALUES ($1, 'provider:cooldown', '-infinity', '-infinity', 0)
                     ON CONFLICT (policy_id, window_name) DO NOTHING`,
                    [policyId]
                );
                const cooldown = await client.query<{ blocked: boolean; window_end: Date }>(
                    `SELECT window_end > clock_timestamp() AS blocked, window_end FROM api_quota_usage
                     WHERE policy_id=$1 AND window_name='provider:cooldown' FOR UPDATE`,
                    [policyId]
                );
                if (cooldown.rows[0]?.blocked) {
                    await client.query("ROLLBACK");
                    return { allowed: false, retryAt: cooldown.rows[0].window_end };
                }
                for (const window of windows) {
                    const existing = await client.query<CounterRow>(
                        `SELECT window_start, window_end, used, previous_used, previous_window_end
                         FROM api_quota_usage WHERE policy_id=$1 AND window_name=$2 FOR UPDATE`,
                        [policyId, window.name]
                    );
                    const old = existing.rows[0];
                    const duration = window.endsAt.getTime() - window.startsAt.getTime();
                    const same = old?.window_start.getTime() === window.startsAt.getTime();
                    const previousEnd = same ? old.previous_window_end : (old?.window_end ?? null);
                    const previousUsed = same ? Number(old.previous_used) : Number(old?.used ?? 0);
                    // Count the whole previous bucket while it can overlap the trailing
                    // interval. Unlike weighted estimates, this cannot undercount bursts.
                    const previousActive =
                        window.rolling &&
                        previousEnd !== null &&
                        previousEnd.getTime() + duration > window.startsAt.getTime();
                    const used = (same ? Number(old.used) : 0) + units;
                    if (
                        (old && window.startsAt < old.window_start) ||
                        !Number.isSafeInteger(used) ||
                        used + (previousActive ? previousUsed : 0) > window.limit
                    ) {
                        await client.query("ROLLBACK");
                        return { allowed: false, retryAt: window.endsAt };
                    }
                    await client.query(
                        `INSERT INTO api_quota_usage
                         (policy_id, window_name, window_start, window_end, used, previous_used, previous_window_end)
                         VALUES ($1,$2,$3,$4,$5,$6,$7)
                         ON CONFLICT (policy_id, window_name) DO UPDATE SET
                         window_start=EXCLUDED.window_start, window_end=EXCLUDED.window_end,
                         used=EXCLUDED.used, previous_used=EXCLUDED.previous_used,
                         previous_window_end=EXCLUDED.previous_window_end`,
                        [
                            policyId,
                            window.name,
                            window.startsAt,
                            window.endsAt,
                            used,
                            previousActive ? previousUsed : 0,
                            previousActive ? previousEnd : null
                        ]
                    );
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
