import { toAlpha2CountryCode, toCountryCode } from "../../shared/countries.js";
import { observeProviderResponse } from "../quotas/quota.feedback.js";
import type { QuotaObserver } from "../quotas/quota.types.js";
import type { MatchPlaceInput } from "./destination.schemas.js";
import type { GuideDestination, GuidePlace } from "./destination.types.js";
import { distanceKm, guideNameMatches } from "./destination.providers.js";

type Json = Record<string, unknown>;
const object = (value: unknown): Json =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : {};
const number = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;

// Map titles sometimes contain links. Keep their visible text; provider HTML is never rendered.
export function plain(value: unknown): string {
    const entities: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
    return typeof value === "string"
        ? value
              .replace(/<[^>]*>/g, "")
              .replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (match, entity: string) => {
                  if (!entity.startsWith("#")) return entities[entity.toLowerCase()] ?? match;
                  const code =
                      entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
                  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
              })
              .replace(/\s+/g, " ")
              .trim()
        : "";
}
const normalized = (value: string) =>
    value
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, "");

// Countries use city markers; city guides use sights. Both keep the travel guide's order.
export async function fetchWikivoyageSights(
    destination: GuideDestination,
    observe?: QuotaObserver,
    reserveAdditionalRequest?: () => Promise<void>
): Promise<GuidePlace[]> {
    const group = destination.kind === "country" ? "city" : "see";
    async function read(params: Record<string, string>, additional = false): Promise<Json[]> {
        if (additional) await reserveAdditionalRequest?.();
        const url = new URL("https://en.wikivoyage.org/w/api.php");
        for (const [key, value] of Object.entries({
            action: "query",
            prop: "mapdata|links",
            mpdgroups: group,
            mpdlimit: "50",
            plnamespace: "0",
            pllimit: "500",
            format: "json",
            formatversion: "2",
            ...params
        }))
            url.searchParams.set(key, value);
        const response = await fetch(url, {
            headers: { "User-Agent": "Roamboard/1.0 (https://github.com/RoamBoard/roamboard; student travel project)" },
            signal: AbortSignal.timeout(8_000)
        });
        await observeProviderResponse(response, observe);
        if (!response.ok) throw new Error(`Wikivoyage returned ${response.status}`);
        const body = object(await response.json());
        if (body.error) throw new Error("Wikivoyage could not return sightseeing listings");
        const pages = object(body.query).pages;
        return Array.isArray(pages) ? pages.map(object) : [];
    }
    function sights(page: Json): GuidePlace[] {
        if (number(page.pageid) === undefined || Number(page.pageid) <= 0 || page.missing) return [];
        const result: GuidePlace[] = [];
        for (const encoded of Array.isArray(page.mapdata) ? page.mapdata : []) {
            if (typeof encoded !== "string") continue;
            const data = object(JSON.parse(encoded));
            for (const raw of Array.isArray(data[group]) ? data[group] : []) {
                const feature = object(raw),
                    geometry = object(feature.geometry),
                    properties = object(feature.properties);
                const coordinates = geometry.coordinates;
                if (feature.type !== "Feature" || geometry.type !== "Point" || !Array.isArray(coordinates)) continue;
                const longitude = number(coordinates[0]),
                    latitude = number(coordinates[1]);
                const name = plain(properties.title);
                if (
                    !name ||
                    name.length > 200 ||
                    latitude === undefined ||
                    longitude === undefined ||
                    Math.abs(latitude) > 90 ||
                    Math.abs(longitude) > 180 ||
                    (destination.kind !== "country" &&
                        distanceKm(destination.latitude, destination.longitude, latitude, longitude) > 25)
                )
                    continue;
                result.push({
                    id: `wikivoyage:${page.pageid}:${name.normalize("NFC").toLowerCase()}`,
                    name,
                    address:
                        destination.kind === "country"
                            ? destination.country
                            : `${destination.name}, ${destination.country}`,
                    latitude,
                    longitude,
                    provider: "wikivoyage"
                });
            }
        }
        return result;
    }
    const pages = await read({
        generator: "search",
        gsrsearch: destination.kind === "country" ? destination.name : `${destination.name} ${destination.country}`,
        gsrnamespace: "0",
        gsrlimit: "5"
    });
    const eligible = pages.filter((page) => {
        const title = plain(page.title);
        if (destination.kind === "country") return guideNameMatches(title, destination);
        return (
            normalized(title.replace(/\s*\([^)]*\)$/, "")) === normalized(destination.name) ||
            normalized(title) === normalized(`${destination.name} ${destination.country}`)
        );
    });
    const page = eligible.sort((a, b) => sights(b).length - sights(a).length)[0];
    if (!page) return [];
    const selected = sights(page);
    if (!selected.length && destination.kind !== "country") {
        const title = plain(page.title);
        const districts = (Array.isArray(page.links) ? page.links : [])
            .map((link) => plain(object(link).title))
            .filter((name) => name.startsWith(`${title}/`))
            .slice(0, 10);
        if (districts.length) {
            const children = await read({ titles: districts.join("|"), prop: "mapdata" }, true);
            const groups = districts.map((district) =>
                sights(children.find((child) => child.title === district) ?? {})
            );
            // Take turns between district guides so one district cannot fill the whole list.
            for (let index = 0; groups.some((group) => index < group.length); index++) {
                selected.push(...groups.flatMap((group) => (group[index] ? [group[index]!] : [])));
            }
        }
    }
    const names = new Set<string>();
    return selected
        .filter((place) => {
            const identity = normalized(place.name);
            if (names.has(identity)) return false;
            names.add(identity);
            return true;
        })
        .slice(0, 10);
}

// A match changes only the temporary map marker. Board links keep the original travel-guide location.
export async function matchMapboxSight(
    input: MatchPlaceInput,
    token: string,
    observe?: QuotaObserver
): Promise<{ latitude: number; longitude: number } | null> {
    const url = new URL("https://api.mapbox.com/search/searchbox/v1/forward");
    for (const [key, value] of Object.entries({
        q: `${input.name}, ${input.city}`,
        types: "poi",
        country: toAlpha2CountryCode(input.country)!.toLowerCase(),
        proximity: `${input.longitude},${input.latitude}`,
        language: "en",
        limit: "5",
        access_token: token
    }))
        url.searchParams.set(key, value);
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    await observeProviderResponse(response, observe);
    if (!response.ok) throw new Error(`Mapbox returned ${response.status}`);
    const body = object(await response.json());
    const matches = (Array.isArray(body.features) ? body.features : []).flatMap((raw) => {
        const feature = object(raw),
            properties = object(feature.properties),
            context = object(properties.context),
            coordinates = object(feature.geometry).coordinates;
        if (
            !Array.isArray(coordinates) ||
            normalized(plain(properties.name_preferred ?? properties.name)) !== normalized(input.name) ||
            toCountryCode(plain(object(context.country).country_code)) !== input.country
        )
            return [];
        const longitude = number(coordinates[0]),
            latitude = number(coordinates[1]);
        if (
            latitude === undefined ||
            longitude === undefined ||
            Math.abs(latitude) > 90 ||
            Math.abs(longitude) > 180 ||
            distanceKm(input.latitude, input.longitude, latitude, longitude) > 0.5
        )
            return [];
        return [{ latitude, longitude }];
    });
    matches.sort(
        (a, b) =>
            distanceKm(input.latitude, input.longitude, a.latitude, a.longitude) -
            distanceKm(input.latitude, input.longitude, b.latitude, b.longitude)
    );
    return matches[0] ?? null;
}
