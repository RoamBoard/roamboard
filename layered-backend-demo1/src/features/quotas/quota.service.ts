import { AppError } from "../../shared/app-error.js";
import type { QuotaPolicy, QuotaRepository, QuotaReservationWindow, QuotaStatus } from "./quota.types.js";

interface DateParts { year: number; month: number; day: number; hour: number; minute: number }

function partsAt(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(formatter.formatToParts(date).flatMap((part) => part.type === "literal" ? [] : [[part.type, Number(part.value)]]));
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute } as DateParts;
}

function zonedInstant(parts: DateParts, timeZone: string): Date {
  const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const initial = new Date(desired);
  const local = partsAt(initial, timeZone);
  const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const adjusted = new Date(desired - (localAsUtc - desired));
  const adjustedLocal = partsAt(adjusted, timeZone);
  const adjustedAsUtc = Date.UTC(adjustedLocal.year, adjustedLocal.month - 1, adjustedLocal.day, adjustedLocal.hour, adjustedLocal.minute);
  return new Date(adjusted.getTime() - (adjustedAsUtc - desired));
}

function bounds(policy: QuotaPolicy, now: Date): QuotaReservationWindow[] {
  return policy.windows.map((window) => {
    const local = partsAt(now, window.timeZone);
    const startParts: DateParts = {
      year: local.year,
      month: local.month,
      day: window.period === "month" ? 1 : local.day,
      hour: window.period === "month" || window.period === "day" ? 0 : local.hour,
      minute: window.period === "minute" ? local.minute : 0,
    };
    const start = zonedInstant(startParts, window.timeZone);
    const end = new Date(start.getTime());
    if (window.period === "minute") end.setUTCMinutes(end.getUTCMinutes() + 1);
    if (window.period === "hour") end.setUTCHours(end.getUTCHours() + 1);
    if (window.period === "day") {
      const nextDay = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day + 1));
      const next = { year: nextDay.getUTCFullYear(), month: nextDay.getUTCMonth() + 1, day: nextDay.getUTCDate(), hour: 0, minute: 0 };
      end.setTime(zonedInstant(next, window.timeZone).getTime());
    }
    if (window.period === "month") {
      const nextMonth = new Date(Date.UTC(startParts.year, startParts.month, 1));
      const next = { year: nextMonth.getUTCFullYear(), month: nextMonth.getUTCMonth() + 1, day: 1, hour: 0, minute: 0 };
      end.setTime(zonedInstant(next, window.timeZone).getTime());
    }
    return { ...window, name: `${window.period}:${window.timeZone}`, startsAt: start, endsAt: end };
  });
}

export interface QuotaService {
  run<T>(policyId: string, operation: () => Promise<T>, units?: number): Promise<T>;
  reserve(policyId: string, units?: number): Promise<void>;
  status(): Promise<{ durable: boolean; policies: QuotaStatus[] }>;
}

export function createQuotaService(repository: QuotaRepository, policies: QuotaPolicy[], clock: () => Date = () => new Date()): QuotaService {
  const byId = new Map(policies.map((policy) => [policy.id, policy]));
  const policyFor = (id: string) => {
    const policy = byId.get(id);
    if (!policy) throw new Error(`Unknown API quota policy: ${id}`);
    return policy;
  };
  const reserve = async (policyId: string, units = 1): Promise<void> => {
    if (!Number.isSafeInteger(units) || units < 1) throw new Error("Quota units must be a positive integer");
    const policy = policyFor(policyId);
    const result = await repository.reserve(policy.id, units, bounds(policy, clock()));
    if (!result.allowed) {
      throw new AppError(429, `${policy.provider} ${policy.operation} is paused because Roamboard reached its hard free-usage limit.`, {
        code: "PROVIDER_QUOTA_EXHAUSTED",
        policyId: policy.id,
        window: result.blocked,
      });
    }
  };
  return {
    reserve,
    run: async <T>(policyId: string, operation: () => Promise<T>, units = 1): Promise<T> => {
      await reserve(policyId, units);
      return operation();
    },
    status: async () => ({
      durable: repository.durable,
      policies: await Promise.all(policies.map(async (policy) => {
        const windows = bounds(policy, clock());
        const used = await repository.usage(policy.id, windows);
        return {
          id: policy.id,
          provider: policy.provider,
          operation: policy.operation,
          unit: policy.unit,
          sourceUrl: policy.sourceUrl,
          windows: windows.map((window, index) => ({
            name: window.name,
            period: window.period,
            limit: window.limit,
            used: used[index] ?? 0,
            remaining: Math.max(0, window.limit - (used[index] ?? 0)),
            startsAt: window.startsAt.toISOString(),
            resetsAt: window.endsAt.toISOString(),
            timeZone: window.timeZone,
          })),
        };
      })),
    }),
  };
}
