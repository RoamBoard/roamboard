import { observeProviderResponse } from "../quotas/quota.feedback.js";
import type { QuotaObserver } from "../quotas/quota.types.js";
import type { ActivityPhotoRequest } from "./provider.schemas.js";
import type { ProviderPhoto } from "./provider.types.js";

type Json = Record<string, unknown>;
export const object = (value: unknown): Json =>
    value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
export const text = (value: unknown): string => (typeof value === "string" ? value : "");
export const normalized = (value: string) =>
    value
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
export const includesPlace = (haystack: string, needle: string) =>
    Boolean(needle) && ` ${normalized(haystack)} `.includes(` ${normalized(needle)} `);
export function distance(lat: number, lon: number, target: ActivityPhotoRequest): number {
    const rad = Math.PI / 180;
    const h =
        Math.sin(((lat - target.latitude) * rad) / 2) ** 2 +
        Math.cos(lat * rad) * Math.cos(target.latitude * rad) * Math.sin(((lon - target.longitude) * rad) / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function matchesActivityPhoto(photo: Json, target: ActivityPhotoRequest): boolean {
    const location = object(photo.location);
    const position = object(location.position);
    const latitude = position.latitude;
    const longitude = position.longitude;
    const hasGps =
        typeof latitude === "number" &&
        Number.isFinite(latitude) &&
        Math.abs(latitude) <= 90 &&
        typeof longitude === "number" &&
        Number.isFinite(longitude) &&
        Math.abs(longitude) <= 180;
    const metres = hasGps ? distance(latitude, longitude, target) : null;
    // Reject contradictory GPS even if an ambiguous place name happens to match.
    if (metres !== null && metres > 3000) return false;
    if (metres !== null && metres <= 100) return true;
    const evidence = [
        photo.description,
        photo.alt_description,
        location.name,
        location.title,
        location.city,
        location.country
    ]
        .map(text)
        .join(" ");
    const place = normalized(target.name);
    if (place.length < 3 || !includesPlace(evidence, place)) return false;
    const context = [target.city, target.country].filter((value) => value && normalized(value) !== place);
    return context.some((value) => includesPlace(evidence, value!));
}
export function photoResult(raw: Json): ProviderPhoto | null {
    const urls = object(raw.urls),
        user = object(raw.user),
        links = object(raw.links),
        userLinks = object(user.links);
    function validUrl(value: unknown, host: string): string | null {
        try {
            const url = new URL(text(value));
            return url.protocol === "https:" && (url.hostname === host || url.hostname.endsWith("." + host))
                ? url.toString()
                : null;
        } catch {
            return null;
        }
    }
    const url = validUrl(urls.regular, "images.unsplash.com"),
        thumbnailUrl = validUrl(urls.small, "images.unsplash.com"),
        sourceUrl = validUrl(links.html, "unsplash.com"),
        photographerUrl = validUrl(userLinks.html, "unsplash.com");
    if (!url || !thumbnailUrl || !sourceUrl || !photographerUrl || !text(user.name) || !text(raw.id)) return null;
    const referral = (input: string) => {
        const url = new URL(input);
        url.searchParams.set("utm_source", "roamboard");
        url.searchParams.set("utm_medium", "referral");
        return url.toString();
    };
    return {
        id: text(raw.id),
        url,
        thumbnailUrl,
        sourceUrl: referral(sourceUrl),
        photographerUrl: referral(photographerUrl),
        photographer: text(user.name),
        alt: text(raw.alt_description) || text(raw.description) || "Activity photograph",
        width: Number(raw.width) || 0,
        height: Number(raw.height) || 0
    };
}
export async function findActivityPhoto(
    target: ActivityPhotoRequest,
    request: (path: string) => Promise<unknown>,
    select = false
): Promise<ProviderPhoto | null> {
    const query = [target.name, target.city, target.country].filter(Boolean).join(" ").slice(0, 200);
    const search = object(
        await request("/search/photos?" + new URLSearchParams({ query, orientation: "landscape", per_page: "5" }))
    );
    const results = Array.isArray(search.results) ? search.results : [];
    for (const candidate of results.slice(0, 3)) {
        const id = text(object(candidate).id);
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) continue;
        const photo = object(await request("/photos/" + encodeURIComponent(id)));
        if (text(photo.id) !== id || !matchesActivityPhoto(photo, target)) continue;
        const result = photoResult(photo);
        if (!result) continue;
        if (select) {
            const download = new URL(text(object(photo.links).download_location));
            if (
                download.protocol !== "https:" ||
                download.hostname !== "api.unsplash.com" ||
                download.username ||
                download.password ||
                download.port ||
                download.pathname !== `/photos/${id}/download`
            )
                throw new Error("Invalid photo selection link");
            await request(download.pathname + download.search);
        }
        return result;
    }
    return null;
}

export async function requestActivityPhoto(path: string, key: string, observe?: QuotaObserver): Promise<unknown> {
    const response = await fetch("https://api.unsplash.com" + path, {
        headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
        signal: AbortSignal.timeout(8000)
    });
    await observeProviderResponse(response, observe);
    if (!response.ok) throw new Error("Unsplash photo request failed");
    return response.json();
}
