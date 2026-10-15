import { AppError } from "../../shared/app-error.js";
import type { QuotaPolicy, QuotaRepository, QuotaReservationWindow, QuotaObserver } from "./quota.types.js";

interface DateParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
}

function partsAt(date: Date, timeZone: string): DateParts {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    });
    const values = Object.fromEntries(
        formatter
            .formatToParts(date)
            .flatMap((part) => (part.type === "literal" ? [] : [[part.type, Number(part.value)]]))
    );
    return {
        year: values.year,
        month: values.month,
        day: values.day,
        hour: values.hour,
        minute: values.minute
    } as DateParts;
}

function zonedInstant(parts: DateParts, timeZone: string): Date {
    const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const initial = new Date(desired);
    const local = partsAt(initial, timeZone);
    const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
    const adjusted = new Date(desired - (localAsUtc - desired));
    const adjustedLocal = partsAt(adjusted, timeZone);
    const adjustedAsUtc = Date.UTC(
        adjustedLocal.year,
        adjustedLocal.month - 1,
        adjustedLocal.day,
        adjustedLocal.hour,
        adjustedLocal.minute
    );
    return new Date(adjusted.getTime() - (adjustedAsUtc - desired));
}

function bounds(policy: QuotaPolicy, now: Date): QuotaReservationWindow[] {
    return policy.windows.map((window) => {
        if (window.rolling) {
            const duration = { second: 1000, minute: 60000, hour: 3600000, day: 86400000, month: 31 * 86400000 }[
                window.period
            ];
            const start = Math.floor(now.getTime() / duration) * duration;
            return {
                ...window,
                name: `${window.period}:rolling:${window.timeZone}`,
                startsAt: new Date(start),
                endsAt: new Date(start + duration)
            };
        }
        if (window.period === "second") {
            const start = new Date(Math.floor(now.getTime() / 1000) * 1000);
            return {
                ...window,
                name: `second:${window.timeZone}`,
                startsAt: start,
                endsAt: new Date(start.getTime() + 1000)
            };
        }
        const local = partsAt(now, window.timeZone);
        const startParts: DateParts = {
            year: local.year,
            month: local.month,
            day: window.period === "month" ? 1 : local.day,
            hour: window.period === "month" || window.period === "day" ? 0 : local.hour,
            minute: window.period === "minute" ? local.minute : 0
        };
        const start = zonedInstant(startParts, window.timeZone);
        const end = new Date(start.getTime());
        if (window.period === "minute") end.setUTCMinutes(end.getUTCMinutes() + 1);
        if (window.period === "hour") end.setUTCHours(end.getUTCHours() + 1);
        if (window.period === "day") {
            const nextDay = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day + 1));
            const next = {
                year: nextDay.getUTCFullYear(),
                month: nextDay.getUTCMonth() + 1,
                day: nextDay.getUTCDate(),
                hour: 0,
                minute: 0
            };
            end.setTime(zonedInstant(next, window.timeZone).getTime());
        }
        if (window.period === "month") {
            const nextMonth = new Date(Date.UTC(startParts.year, startParts.month, 1));
            const next = {
                year: nextMonth.getUTCFullYear(),
                month: nextMonth.getUTCMonth() + 1,
                day: 1,
                hour: 0,
                minute: 0
            };
            end.setTime(zonedInstant(next, window.timeZone).getTime());
        }
        return { ...window, name: `${window.period}:${window.timeZone}`, startsAt: start, endsAt: end };
    });
}

export interface QuotaService {
    run<T>(policyId: string, operation: (observe?: QuotaObserver) => Promise<T>, units?: number): Promise<T>;
    reserve(policyId: string, units?: number): Promise<void>;
}

export function createQuotaService(
    repository: QuotaRepository,
    policies: QuotaPolicy[],
    clock: () => Date = () => new Date()
): QuotaService {
    const byId = new Map(policies.map((policy) => [policy.id, policy]));
    const policyFor = (id: string) => {
        const policy = byId.get(id);
        if (!policy) throw new Error(`Unknown API quota policy: ${id}`);
        return policy;
    };
    const reserve = async (policyId: string, units = 1): Promise<void> => {
        if (!Number.isSafeInteger(units) || units < 1) throw new Error("Quota units must be a positive integer");
        const policy = policyFor(policyId);
        const windows = bounds(policy, clock());
        if (windows.some((window) => units > window.limit)) {
            throw new AppError(
                429,
                "This provider operation exceeds its configured limit.",
                "PROVIDER_QUOTA_EXHAUSTED"
            );
        }
        const result = await repository.reserve(policy.id, units, windows);
        if (!result.allowed) {
            throw new AppError(
                429,
                `${policy.provider} ${policy.operation} is paused because Roamboard reached its hard free-usage limit.`,
                "PROVIDER_QUOTA_EXHAUSTED",
                result.retryAt
            );
        }
    };
    return {
        reserve,
        run: async <T>(policyId: string, operation: (observe?: QuotaObserver) => Promise<T>, units = 1): Promise<T> => {
            await reserve(policyId, units);
            const observe: QuotaObserver = async ({ status, retryAt, exhausted }) => {
                const now = clock();
                if (status !== 429 && !(status === 503 && retryAt) && !retryAt && !exhausted) return;
                const fallback = policyFor(policyId).windows.reduce(
                    (longest, window) =>
                        Math.max(
                            longest,
                            { second: 1000, minute: 60000, hour: 3600000, day: 86400000, month: 31 * 86400000 }[
                                window.period
                            ]
                        ),
                    5000
                );
                const until =
                    retryAt && retryAt > now ? retryAt : new Date(now.getTime() + (exhausted ? fallback : 5000));
                if (repository.block) await repository.block(policyId, until);
                if (status === 429 || status === 503) {
                    throw new AppError(
                        429,
                        "The provider is rate limited. Please try again later.",
                        "PROVIDER_QUOTA_EXHAUSTED",
                        until
                    );
                }
            };
            return operation(observe);
        }
    };
}
