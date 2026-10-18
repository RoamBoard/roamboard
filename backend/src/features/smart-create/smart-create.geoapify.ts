import { setTimeout as delay } from "node:timers/promises";
import type { QuotaObserver } from "../quotas/quota.types.js";
import type { QuotaService } from "../quotas/quota.service.js";
import { nearbyPhotoPlace, reverseGeoapify } from "../providers/provider.geoapify.js";
import type { SmartCreateResolver } from "./smart-create.service.js";
import { AppError } from "../../shared/app-error.js";
export function createSmartCreateResolver(quota: QuotaService): SmartCreateResolver {
    let nextCallAt = 0;
    const call = async <T>(operation: (observe?: QuotaObserver) => Promise<T>): Promise<T> => {
        const wait = Math.max(0, nextCallAt - Date.now());
        nextCallAt = Date.now() + wait + 1100;
        if (wait) await delay(wait);
        return quota.run("geoapify.geocoding", operation);
    };
    return async (latitude, longitude) => {
        const key = process.env.GEOAPIFY_API_KEY;
        if (!key) throw new AppError(503, "Place lookup is not configured", "PROVIDER_UNAVAILABLE");
        const place = await call((observe) => nearbyPhotoPlace(latitude, longitude, key, observe));
        if (place) return place;
        const address = await call((observe) => reverseGeoapify(latitude, longitude, key, observe));
        return {
            ...address,
            label: address.detail || address.address || address.label,
            type: address.detail ? address.type : "address"
        };
    };
}
