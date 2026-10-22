import { randomInt } from "node:crypto";
import { countryName } from "../../shared/countries.js";
import { createLibraryProvider } from "../image-library/image-library.provider.js";
import type { QuotaService } from "../quotas/quota.service.js";
import type { BoardWrite } from "./boards.schemas.js";
import type { FillerPool, FillerProvider } from "./boards.types.js";

export function destinationKey(destination: BoardWrite["destination"]): string {
    return destination ? JSON.stringify([destination.kind, destination.country, destination.externalPlaceId]) : "";
}

export function createFillerProvider(quota: QuotaService, search: FillerProvider["search"]): FillerProvider {
    const library = createLibraryProvider(quota);
    return {
        search,
        async select(id) {
            const asset = await library.unsplash(id);
            const large = new URL(asset.url);
            large.searchParams.set(
                "w",
                String(Math.max(1, Math.floor(Math.min(4096, asset.width, (4096 * asset.width) / asset.height))))
            );
            large.searchParams.set("fit", "max");
            return {
                provider: "unsplash",
                providerImageId: id,
                url: asset.url,
                thumbnailUrl: asset.thumbnailUrl,
                largeUrl: large.toString(),
                width: asset.width,
                height: asset.height,
                alt: asset.alt,
                photographer: asset.credit,
                photographerUrl: asset.photographerUrl,
                sourceUrl: asset.sourceUrl
            };
        }
    };
}

// Optional imagery never prevents saving. Each explicit save makes at most one search and no request retries.
export async function prepareFillerPool(
    input: BoardWrite,
    existing: FillerPool | null,
    provider?: FillerProvider
): Promise<FillerPool | undefined> {
    if (!input.fillerImagesEnabled || input.status !== "published") return undefined;
    const key = destinationKey(input.destination);
    const excluded = new Set(
        input.days.flatMap((day) =>
            day.activities.flatMap((a) => (a.externalImage ? [a.externalImage.providerImageId] : []))
        )
    );
    const images =
        existing?.destinationKey === key ? existing.images.filter((image) => !excluded.has(image.providerImageId)) : [];
    const pool: FillerPool = { destinationKey: key, images: images.slice(0, 3) };
    if (!input.destination || pool.images.length === 3 || !provider) return pool;
    try {
        const candidates = await provider.search(`${input.destination.name} ${countryName(input.destination.country)}`);
        const ids = [...new Set(candidates.slice(0, 20).map((photo) => photo.id))].filter(
            (id) => id && !excluded.has(id) && !pool.images.some((image) => image.providerImageId === id)
        );
        while (ids.length && pool.images.length < 3) {
            const [id] = ids.splice(randomInt(ids.length), 1);
            // A failed selection may signal exhausted quota; stop instead of issuing more provider work.
            const photo = await provider.select(id!);
            if (
                Number.isSafeInteger(photo.width) &&
                Number.isSafeInteger(photo.height) &&
                photo.width > 0 &&
                photo.height > 0 &&
                photo.providerImageId === id &&
                photo.provider === "unsplash" &&
                photo.photographer &&
                photo.photographerUrl &&
                photo.sourceUrl
            )
                pool.images.push({ ...photo, position: pool.images.length });
        }
    } catch {
        /* Keep valid matching selections and save with an honest partial/unavailable status. */
    }
    pool.images = pool.images.map((image, position) => ({ ...image, position }));
    return pool;
}
