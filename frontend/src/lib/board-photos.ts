import { findCountry } from "./countries";
import { getBoardDays } from "./board-presentation";
import { searchUnsplashProvider, type ProviderPhoto } from "./providers";
import type { Board, BoardActivity, BoardImage, BoardLocation } from "../types/board";

export type PhotoSlot = {
    id: string;
    dayNumber?: number;
    label: string;
    query: string | null;
    backupQuery: string | null;
    enabled: boolean;
};

type PhotoSearch = (query: string) => Promise<ProviderPhoto[]>;
type CacheEntry = { expiresAt: number; result: Promise<ProviderPhoto[]> };
const cleanQuery = (query: string) => query.trim().replace(/\s+/g, " ").slice(0, 100);
const queryKey = (query: string) => cleanQuery(query).toLowerCase();

// This cache avoids repeated searches within a browser tab. The backend still counts every upstream request.
export function createBoardPhotoSource(
    search: PhotoSearch = (query) => searchUnsplashProvider(query, 10),
    now: () => number = Date.now
): PhotoSearch {
    const cache = new Map<string, CacheEntry>();
    return (input) => {
        const query = cleanQuery(input);
        if (query.length < 2) return Promise.resolve([]);
        const key = queryKey(query);
        const cached = cache.get(key);
        if (cached && cached.expiresAt > now()) return cached.result;
        cache.delete(key);
        if (cache.size >= 64) cache.delete(cache.keys().next().value!);
        const entry: CacheEntry = { expiresAt: Infinity, result: Promise.resolve([]) };
        entry.result = (async () => {
            try {
                const result = await search(query);
                const photos = Array.isArray(result) ? result : [];
                entry.expiresAt = now() + (photos.length ? 3_600_000 : 300_000);
                return photos;
            } catch (error) {
                entry.expiresAt = now() + 30_000;
                throw error;
            }
        })();
        cache.set(key, entry);
        return entry.result;
    };
}

export const searchBoardPhotos = createBoardPhotoSource();

function locationContext(location?: BoardLocation) {
    const country = location?.countryCode ? findCountry(location.countryCode)?.name : undefined;
    return { place: location?.city || location?.name || "", country: country ?? "" };
}

export function getBoardPhotoSlots(board: Board, tagLabels: string[] = []): PhotoSlot[] {
    const located = board.items.find(
        (item): item is BoardActivity => item.type === "activity" && item.location !== undefined
    );
    const destination = board.destinations[0];
    const overall = destination
        ? { place: destination.cities?.[0] ?? "", country: destination.country }
        : locationContext(located?.location);
    const tag = tagLabels[0] ?? "";
    function makeSlot(id: string, location?: BoardLocation, dayNumber?: number): PhotoSlot {
        const context = location ? locationContext(location) : overall;
        const primary = cleanQuery([context.place, context.country].filter(Boolean).join(" "));
        const backup = cleanQuery([context.country, tag, ...(tag ? ["travel"] : [])].filter(Boolean).join(" "));
        const query = primary.length >= 2 ? primary : backup.length >= 2 ? backup : null;
        return {
            id,
            dayNumber,
            label:
                location?.name || [context.place, context.country].filter(Boolean).join(", ") || board.title || "Board",
            query,
            backupQuery: backup.length >= 2 && queryKey(backup) !== queryKey(query ?? "") ? backup : null,
            enabled: id !== "cover" || !board.coverImage?.url
        };
    }
    return [
        makeSlot("cover"),
        ...getBoardDays(board).flatMap((day) => {
            const activities = day.items.filter((item) => item.type === "activity");
            if (!activities.length) return [];
            return [
                makeSlot(`day-${day.number}-first`, activities[0].location, day.number),
                ...(activities[3] ? [makeSlot(`day-${day.number}-second`, activities[3].location, day.number)] : [])
            ];
        })
    ];
}

function imageIdentity(url: string): string | null {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" ? `${parsed.origin}${parsed.pathname}` : null;
    } catch {
        return null;
    }
}

export async function resolveBoardPhotos(
    board: Board,
    slots: PhotoSlot[],
    search: PhotoSearch = searchBoardPhotos
): Promise<Record<string, BoardImage>> {
    const savedImages = [
        ...(board.coverImage ? [board.coverImage] : []),
        ...board.items.flatMap((item) =>
            item.type === "image" ? [item.image] : "images" in item ? (item.images ?? []) : []
        )
    ];
    const usedIds = new Set(savedImages.map((image) => image.id.replace(/^unsplash-/, "")));
    const usedUrls = new Set(savedImages.flatMap((image) => imageIdentity(image.url) ?? []));
    const selected: Record<string, BoardImage> = {};
    const pools = new Map<string, ProviderPhoto[]>();
    const failedQueries = new Set<string>();
    async function fill(backup: boolean) {
        const pending = slots.filter(
            (slot) =>
                slot.enabled && !selected[slot.id] && !(backup && slot.query && failedQueries.has(queryKey(slot.query)))
        );
        const queries = new Map<string, string>();
        for (const slot of pending) {
            const query = backup ? slot.backupQuery : slot.query;
            if (query && !pools.has(queryKey(query))) queries.set(queryKey(query), query);
        }
        await Promise.all(
            [...queries].map(async ([key, query]) => {
                const photos = await search(query).catch(() => {
                    failedQueries.add(key);
                    return [];
                });
                pools.set(key, Array.isArray(photos) ? photos : []);
            })
        );
        for (const slot of pending) {
            const query = backup ? slot.backupQuery : slot.query;
            if (!query) continue;
            const photo = pools.get(queryKey(query))?.find((candidate) => {
                const identity = imageIdentity(candidate.url);
                return candidate.id && identity && !usedIds.has(candidate.id) && !usedUrls.has(identity);
            });
            if (!photo) continue;
            usedIds.add(photo.id);
            usedUrls.add(imageIdentity(photo.url)!);
            selected[slot.id] = {
                id: `unsplash-${photo.id}`,
                url: photo.url,
                alt: photo.alt || slot.label,
                source: "application",
                photographer: photo.photographer,
                photographerUrl: photo.photographerUrl,
                sourceUrl: photo.sourceUrl
            };
        }
    }
    await fill(false);
    await fill(true);
    return selected;
}
