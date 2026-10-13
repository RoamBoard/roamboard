import type { QuotaRepository, QuotaReservationResult, QuotaReservationWindow, QuotaUsageWindow } from "./quota.types.js";

interface StoredUsage {
  used: number;
  endsAt: Date;
}

function usageWindow(window: QuotaReservationWindow, used: number): QuotaUsageWindow {
  return {
    name: window.name,
    period: window.period,
    limit: window.limit,
    used,
    remaining: Math.max(0, window.limit - used),
    startsAt: window.startsAt.toISOString(),
    resetsAt: window.endsAt.toISOString(),
    timeZone: window.timeZone,
  };
}

export function createMemoryQuotaRepository(): QuotaRepository {
  const values = new Map<string, StoredUsage>();
  const keyFor = (policyId: string, window: QuotaReservationWindow) => `${policyId}:${window.name}:${window.startsAt.toISOString()}`;

  return {
    durable: false,
    reserve: async (policyId, units, windows): Promise<QuotaReservationResult> => {
      const earliestStart = Math.min(...windows.map((window) => window.startsAt.getTime()));
      values.forEach((value, key) => {
        if (value.endsAt.getTime() <= earliestStart) values.delete(key);
      });
      const blocked = windows.find((window) => (values.get(keyFor(policyId, window))?.used ?? 0) + units > window.limit);
      if (blocked) return { allowed: false, blocked: usageWindow(blocked, values.get(keyFor(policyId, blocked))?.used ?? 0) };
      windows.forEach((window) => {
        const key = keyFor(policyId, window);
        values.set(key, { used: (values.get(key)?.used ?? 0) + units, endsAt: window.endsAt });
      });
      return { allowed: true };
    },
    usage: async (policyId, windows) => windows.map((window) => values.get(keyFor(policyId, window))?.used ?? 0),
  };
}
