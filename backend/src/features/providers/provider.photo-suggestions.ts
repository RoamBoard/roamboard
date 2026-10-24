import { AppError } from "../../shared/app-error.js";
import type { PhotoSuggestionRequest } from "./provider.schemas.js";
import { distance, includesPlace, normalized, object, photoResult, text } from "./provider.activity-photo.js";
import type { resolvePhotoArea } from "./provider.geoapify.js";
import type { ProviderPhoto } from "./provider.types.js";

type Area = Awaited<ReturnType<typeof resolvePhotoArea>>;
type Point = { latitude: number; longitude: number };
type Context = { kind: "illustrative"; scope: "nearby" | "region"; locationLabel: string };
export type SuggestedPhoto = ProviderPhoto & { context: Context };
type Dependencies = { request: (path: string) => Promise<unknown>; area: (point: Point) => Promise<Area> };

const subjects: Record<string, RegExp> = {
    nature: /lake|river|forest|mountain|landscape|waterfall|nature|countryside/,
    hike: /hike|hiking|trail|mountain|forest/,
    beach: /beach|coast|shore|sand|sea/,
    park: /park|garden/,
    restaurant: /restaurant|dining|food|meal/,
    cafe: /cafe|coffee/,
    bar: /bar|pub|cocktail/,
    museum: /museum|gallery|exhibition/,
    culture: /culture|temple|church|museum|historic|architecture/,
    landmark: /landmark|monument|tower|castle|temple|church|historic|architecture/,
    stay: /hotel|cabin|hostel|accommodation|cottage|camp/,
    shopping: /shop|market|store/,
    transit: /train|station|bus|tram|airport|ferry/,
    event: /festival|concert|event/,
    city: /city|town|skyline|street/,
    neighborhood: /neighborhood|neighbourhood|street|town/
};

function gps(photo: Record<string, unknown>): Point | null {
    const position = object(object(photo.location).position);
    return typeof position.latitude === "number" &&
        Number.isFinite(position.latitude) &&
        Math.abs(position.latitude) <= 90 &&
        typeof position.longitude === "number" &&
        Number.isFinite(position.longitude) &&
        Math.abs(position.longitude) <= 180
        ? { latitude: position.latitude, longitude: position.longitude }
        : null;
}

export function relevantPhoto(photo: Record<string, unknown>, target: PhotoSuggestionRequest): boolean {
    const evidence = normalized([photo.description, photo.alt_description].map(text).join(" "));
    const subject = subjects[target.category];
    return subject ? subject.test(evidence) : includesPlace(evidence, target.name);
}

async function contextFor(
    photo: Record<string, unknown>,
    target: PhotoSuggestionRequest,
    targetArea: Area,
    area: Dependencies["area"]
): Promise<Context | null> {
    if (!targetArea?.country || !targetArea.countryCode || !relevantPhoto(photo, target)) return null;
    const location = object(photo.location);
    const point = gps(photo);
    const namedCountry = text(location.country);
    if (namedCountry && normalized(namedCountry) !== normalized(targetArea.country)) return null;
    const evidence = [location.name, location.title, location.city, location.country].map(text).join(" ");
    const same = (a: string | null | undefined, b: string | null | undefined) =>
        Boolean(a && b && normalized(a) === normalized(b));
    if (point) {
        const candidateArea = await area(point);
        if (!candidateArea || candidateArea.countryCode !== targetArea.countryCode) return null;
        if (distance(point.latitude, point.longitude, target) <= 25000) {
            const label = [candidateArea.city || candidateArea.region, candidateArea.country]
                .filter(Boolean)
                .join(", ");
            return { kind: "illustrative", scope: "nearby", locationLabel: label };
        }
        if (!same(candidateArea.region, targetArea.region)) return null;
        return {
            kind: "illustrative",
            scope: "region",
            locationLabel: `${candidateArea.region}, ${candidateArea.country}`
        };
    }
    if (!includesPlace(evidence, targetArea.country)) return null;
    if (targetArea.city && includesPlace(evidence, targetArea.city))
        return { kind: "illustrative", scope: "nearby", locationLabel: `${targetArea.city}, ${targetArea.country}` };
    if (targetArea.region && includesPlace(evidence, targetArea.region))
        return { kind: "illustrative", scope: "region", locationLabel: `${targetArea.region}, ${targetArea.country}` };
    return null;
}

export async function discoverPhotoSuggestions(
    target: PhotoSuggestionRequest,
    dependencies: Dependencies
): Promise<SuggestedPhoto[]> {
    const targetArea = await dependencies.area(target);
    if (!targetArea?.countryCode || (target.countryCode && target.countryCode !== targetArea.countryCode)) return [];
    const seen = new Set<string>();
    const result: SuggestedPhoto[] = [];
    for (const scope of ["nearby", "region"] as const) {
        if (scope === "region" && (!targetArea.region || result.length)) break;
        const place = scope === "nearby" ? targetArea.city || target.name : targetArea.region;
        const query = [place, targetArea.country, target.category].filter(Boolean).join(" ").slice(0, 200);
        const search = object(
            await dependencies.request(
                "/search/photos?" + new URLSearchParams({ query, per_page: "5", orientation: "landscape" })
            )
        );
        const candidates = Array.isArray(search.results) ? search.results : [];
        let inspected = 0;
        for (const candidate of candidates) {
            const id = text(object(candidate).id);
            if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || seen.has(id)) continue;
            if (inspected >= 2) break;
            inspected++;
            seen.add(id);
            const raw = object(await dependencies.request("/photos/" + encodeURIComponent(id)));
            if (text(raw.id) !== id) continue;
            const photo = photoResult(raw);
            if (!photo) continue;
            const context = await contextFor(raw, target, targetArea, dependencies.area);
            if (context) result.push({ ...photo, context });
            if (result.length >= 3) return result;
        }
    }
    return result.some((photo) => photo.context.scope === "nearby")
        ? result.filter((photo) => photo.context.scope === "nearby")
        : result;
}

export async function selectPhotoSuggestion(
    target: PhotoSuggestionRequest & { photoId: string },
    dependencies: Dependencies
): Promise<SuggestedPhoto> {
    const targetArea = await dependencies.area(target);
    const raw = object(await dependencies.request("/photos/" + encodeURIComponent(target.photoId)));
    const photo = photoResult(raw);
    const context =
        text(raw.id) === target.photoId && (!target.countryCode || targetArea?.countryCode === target.countryCode)
            ? await contextFor(raw, target, targetArea, dependencies.area)
            : null;
    if (!photo || !context)
        throw new AppError(422, "This photo no longer matches the activity area", "PHOTO_SUGGESTION_NOT_ELIGIBLE");
    const download = new URL(text(object(raw.links).download_location));
    if (
        download.protocol !== "https:" ||
        download.hostname !== "api.unsplash.com" ||
        download.username ||
        download.password ||
        download.port ||
        download.pathname !== `/photos/${target.photoId}/download`
    )
        throw new Error("Invalid photo selection link");
    await dependencies.request(download.pathname + download.search);
    return { ...photo, context };
}
