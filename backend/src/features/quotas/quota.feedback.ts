import { AppError } from "../../shared/app-error.js";
import type { QuotaObserver } from "./quota.types.js";

function dateValue(value: string | null, epoch = false): Date | undefined {
    if (!value?.trim()) return undefined;
    const milliseconds = epoch && /^\d+(\.\d+)?$/.test(value) ? Number(value) * 1000 : Date.parse(value);
    const result = new Date(milliseconds);
    return Number.isFinite(result.getTime()) ? result : undefined;
}

export async function observeProviderResponse(response: Response, observe?: QuotaObserver): Promise<void> {
    const retry = response.headers.get("retry-after");
    const retryAt =
        retry && /^\d+(\.\d+)?$/.test(retry.trim()) ? new Date(Date.now() + Number(retry) * 1000) : dateValue(retry);
    const remaining = response.headers.get("x-ratelimit-remaining") ?? response.headers.get("x-rate-limit-remaining");
    const exhausted = remaining !== null && remaining.trim() !== "" && Number(remaining) === 0;
    const resetAt =
        response.status === 429 || exhausted
            ? dateValue(response.headers.get("x-ratelimit-reset") ?? response.headers.get("x-rate-limit-reset"), true)
            : undefined;
    const until = [retryAt, resetAt]
        .filter((date): date is Date => date !== undefined && Number.isFinite(date.getTime()))
        .sort((left, right) => right.getTime() - left.getTime())[0];
    await observe?.({ status: response.status, retryAt: until, exhausted });
    if (response.status === 429 || (response.status === 503 && until)) {
        throw new AppError(
            429,
            "The provider is rate limited. Please try again later.",
            "PROVIDER_QUOTA_EXHAUSTED",
            until
        );
    }
}

export async function observeCloudinary<T>(operation: () => Promise<T>, observe?: QuotaObserver): Promise<T> {
    try {
        const result = await operation();
        const metadata = result as Record<string, unknown>;
        if (metadata.rate_limit_remaining === 0) {
            await observe?.({
                status: 200,
                exhausted: true,
                retryAt: dateValue(String(metadata.rate_limit_reset_at ?? ""), true)
            });
        }
        return result;
    } catch (error) {
        const metadata = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
        if (metadata.http_code === 420 || metadata.http_code === 429) {
            const until = dateValue(String(metadata.rate_limit_reset_at ?? ""), true);
            await observe?.({ status: 429, retryAt: until });
            throw new AppError(
                429,
                "Cloudinary is rate limited. Please try again later.",
                "PROVIDER_QUOTA_EXHAUSTED",
                until
            );
        }
        throw error;
    }
}
