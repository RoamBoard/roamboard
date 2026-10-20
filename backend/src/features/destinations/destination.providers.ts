import { toCountryCode } from "../../shared/countries.js";
import { destinationSuggestions, type DestinationCandidate } from "./destination.suggestions.js";
import { observeProviderResponse } from "../quotas/quota.feedback.js";
import type { QuotaObserver } from "../quotas/quota.types.js";
import type {
    DestinationArticle,
    DestinationImage,
    DestinationResult,
    DestinationWeather
} from "./destination.types.js";
import type { GuideDestination, GuideArticle } from "./destination.types.js";

interface MapboxFeature {
    id?: unknown;
    geometry?: { coordinates?: unknown };
    properties?: Record<string, unknown>;
}

interface MapboxSearchOptions {
    query: string;
    poi: boolean;
}

function objectValue(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function stringValue(value: unknown, fallback = ""): string {
    return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

// Guide matching and travel-guide sights compare real distances, regardless of city-name spelling.
export function distanceKm(latitude1: number, longitude1: number, latitude2: number, longitude2: number): number {
    const radians = (degrees: number) => (degrees * Math.PI) / 180;
    const haversine =
        Math.sin(radians(latitude2 - latitude1) / 2) ** 2 +
        Math.cos(radians(latitude1)) *
            Math.cos(radians(latitude2)) *
            Math.sin(radians(longitude2 - longitude1) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

async function readJson(response: Response): Promise<unknown> {
    const body = await response.text();
    return body ? (JSON.parse(body) as unknown) : {};
}

async function requestMapbox(
    options: MapboxSearchOptions,
    limit: number,
    token: string,
    observe?: QuotaObserver
): Promise<DestinationCandidate[]> {
    const url = new URL(
        options.poi
            ? "https://api.mapbox.com/search/searchbox/v1/forward"
            : "https://api.mapbox.com/search/geocode/v6/forward"
    );
    url.searchParams.set("q", options.query);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("language", "en");
    if (!options.poi) {
        url.searchParams.set("autocomplete", "true");
        url.searchParams.set("types", "country,region,place");
    }
    url.searchParams.set("access_token", token);
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    await observeProviderResponse(response, observe);
    if (!response.ok) throw new Error(`Mapbox returned ${response.status}`);
    const body = objectValue(await readJson(response));
    const features = Array.isArray(body.features) ? body.features : [];

    return features.flatMap((value, index) => {
        const feature = objectValue(value) as MapboxFeature;
        const properties = objectValue(feature.properties);
        const coordinates = Array.isArray(feature.geometry?.coordinates) ? feature.geometry.coordinates : [];
        const longitude = numberValue(coordinates[0]);
        const latitude = numberValue(coordinates[1]);
        if (longitude === undefined || latitude === undefined || Math.abs(longitude) > 180 || Math.abs(latitude) > 90)
            return [];
        const name = stringValue(properties.name_preferred ?? properties.name, "Unknown place");
        const featureType = stringValue(properties.feature_type, "unknown");
        const context = objectValue(properties.context);
        const countryContext = objectValue(context.country);
        const placeContext = objectValue(context.place);
        const ownContext = objectValue(context[featureType]);
        const regionContext = objectValue(context.region);
        const districtContext = objectValue(context.district);
        const country = stringValue(countryContext.name, featureType === "country" ? name : "");
        const countryCode = stringValue(
            countryContext.country_code_alpha_3,
            stringValue(countryContext.country_code)
        ).toUpperCase();
        const city = featureType === "place" ? name : options.poi ? stringValue(placeContext.name) : "";
        return [
            {
                names: [
                    name,
                    stringValue(properties.name),
                    stringValue(ownContext.name),
                    stringValue(objectValue(ownContext.alternate).name)
                ].filter(Boolean),
                qualifiers: [regionContext, districtContext, countryContext].flatMap((item) =>
                    [item.name, item.region_code, item.region_code_full, item.country_code, item.country_code_alpha_3]
                        .map((value) => stringValue(value))
                        .filter(Boolean)
                ),
                destination: {
                    id: stringValue(feature.id ?? properties.mapbox_id, `mapbox-${index}`),
                    name,
                    address: stringValue(properties.full_address ?? properties.place_formatted, name),
                    latitude,
                    longitude,
                    placeType: featureType,
                    context: [stringValue(placeContext.name), country].filter(Boolean),
                    country: country || null,
                    countryCode: toCountryCode(countryCode),
                    city: city || null
                }
            }
        ];
    });
}

export function searchMapbox(
    query: string,
    limit: number,
    token: string,
    observe?: QuotaObserver
): Promise<DestinationResult[]> {
    return requestMapbox({ query, poi: false }, 10, token, observe).then((results) =>
        destinationSuggestions(results, query, limit)
    );
}

export function searchMapboxPlaces(
    query: string,
    limit: number,
    token: string,
    observe?: QuotaObserver
): Promise<DestinationResult[]> {
    return requestMapbox({ query, poi: true }, limit, token, observe).then((results) =>
        results.map((result) => result.destination)
    );
}

export async function fetchWeather(
    latitude: number,
    longitude: number,
    observe?: QuotaObserver
): Promise<DestinationWeather> {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("daily", "temperature_2m_min,temperature_2m_max,precipitation_probability_max");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "5");
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    await observeProviderResponse(response, observe);
    if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
    const body = objectValue(await readJson(response));
    const daily = objectValue(body.daily);
    return {
        timezone: stringValue(body.timezone, "local time"),
        dates: Array.isArray(daily.time) ? daily.time.filter((item): item is string => typeof item === "string") : [],
        minimums: Array.isArray(daily.temperature_2m_min)
            ? daily.temperature_2m_min.filter((item): item is number => typeof item === "number")
            : [],
        maximums: Array.isArray(daily.temperature_2m_max)
            ? daily.temperature_2m_max.filter((item): item is number => typeof item === "number")
            : [],
        precipitation: Array.isArray(daily.precipitation_probability_max)
            ? daily.precipitation_probability_max.filter((item): item is number => typeof item === "number")
            : []
    };
}

export async function fetchWikipedia(query: string, observe?: QuotaObserver): Promise<DestinationArticle | undefined> {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("gsrlimit", "1");
    url.searchParams.set("prop", "extracts|pageimages|info");
    url.searchParams.set("inprop", "url");
    url.searchParams.set("exintro", "1");
    url.searchParams.set("explaintext", "1");
    url.searchParams.set("piprop", "thumbnail");
    url.searchParams.set("pithumbsize", "600");
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "2");
    const response = await fetch(url, {
        headers: { "User-Agent": "Roamboard/1.0 (https://github.com/RoamBoard/roamboard; student travel project)" },
        signal: AbortSignal.timeout(8_000)
    });
    await observeProviderResponse(response, observe);
    if (!response.ok) throw new Error(`Wikipedia returned ${response.status}`);
    const body = objectValue(await readJson(response));
    const pageValues = objectValue(body.query).pages;
    const page = objectValue(Array.isArray(pageValues) ? pageValues[0] : undefined);
    const title = stringValue(page.title);
    const extract = stringValue(page.extract);
    const urlValue = stringValue(page.fullurl);
    return title && extract && urlValue
        ? {
              title,
              description: extract,
              url: urlValue,
              thumbnailUrl: stringValue(objectValue(page.thumbnail).source) || undefined
          }
        : undefined;
}

export function cityName(value: string): string {
    return value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/\s*\([^)]*\)/g, "")
        .split(",")[0]!
        .replace(/^city of\s+|\s+city$/g, "")
        .trim();
}

export function guideNameMatches(title: string, destination: GuideDestination): boolean {
    if (destination.kind !== "country") return cityName(title) === cityName(destination.name);
    const normalize = (value: string) =>
        value
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .trim()
            .toLowerCase();
    return normalize(title) === normalize(destination.name);
}

// Keep the guide brief without rewriting the source or cutting a sentence unless it alone exceeds the limit.
export function guideExcerpt(text: string, sentenceLimit = 3, wordLimit = 80): string {
    const sentences = Array.from(new Intl.Segmenter("en", { granularity: "sentence" }).segment(text)).slice(
        0,
        sentenceLimit
    );
    let excerpt = "";
    for (const sentence of sentences) {
        const candidate = excerpt + sentence.segment;
        if (candidate.trim().split(/\s+/).length > wordLimit)
            return excerpt.trim()
                ? `${excerpt.trim()}...`
                : `${candidate.trim().split(/\s+/).slice(0, wordLimit).join(" ")}...`;
        excerpt = candidate;
    }
    return excerpt.trim();
}

export async function fetchWikivoyageGuide(
    destination: GuideDestination,
    observe?: QuotaObserver
): Promise<GuideArticle | null> {
    const url = new URL("https://en.wikivoyage.org/w/api.php");
    const parameters = {
        action: "query",
        generator: "search",
        gsrsearch: destination.kind === "country" ? destination.name : `${destination.name} ${destination.country}`,
        gsrnamespace: "0",
        gsrlimit: "5",
        prop: "extracts|coordinates|pageprops|info",
        inprop: "url",
        exintro: "1",
        explaintext: "1",
        exlimit: "5",
        coprimary: "primary",
        colimit: "1",
        ppprop: "disambiguation",
        format: "json",
        formatversion: "2"
    };
    for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value);
    const response = await fetch(url, {
        headers: { "User-Agent": "Roamboard/1.0 (https://github.com/RoamBoard/roamboard; student travel project)" },
        signal: AbortSignal.timeout(8_000)
    });
    await observeProviderResponse(response, observe);
    if (!response.ok) throw new Error(`Wikivoyage returned ${response.status}`);
    const body = objectValue(await readJson(response));
    if (body.error) throw new Error("Wikivoyage could not complete the guide search");
    const pages = objectValue(body.query).pages;
    let article: GuideArticle | null = null;
    let nearest = destination.kind === "country" ? Infinity : 50;
    for (const candidate of Array.isArray(pages) ? pages : []) {
        const page = objectValue(candidate);
        if ("disambiguation" in objectValue(page.pageprops) || !guideNameMatches(stringValue(page.title), destination))
            continue;
        const coordinates = Array.isArray(page.coordinates) ? page.coordinates : [];
        const coordinate = coordinates.map(objectValue).find((item) => item.primary === true || item.primary === "");
        if (coordinate?.globe !== undefined && coordinate.globe !== "earth") continue;
        if (!coordinate && destination.kind !== "country") continue;
        const latitude =
            numberValue(coordinate?.lat) ?? (destination.kind === "country" ? destination.latitude : undefined);
        const longitude =
            numberValue(coordinate?.lon) ?? (destination.kind === "country" ? destination.longitude : undefined);
        if (latitude === undefined || longitude === undefined || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
            continue;
        const distance = distanceKm(destination.latitude, destination.longitude, latitude, longitude);
        const title = stringValue(page.title);
        const description = stringValue(page.extract);
        const articleUrl = stringValue(page.fullurl);
        if (distance <= nearest && title && description && articleUrl.startsWith("https://en.wikivoyage.org/wiki/")) {
            nearest = distance;
            article = { title, description: guideExcerpt(description), url: articleUrl };
        }
    }
    return article;
}

export async function fetchUnsplash(
    query: string,
    accessKey: string,
    observe?: QuotaObserver
): Promise<DestinationImage | undefined> {
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", `${query} travel`);
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("per_page", "1");
    const response = await fetch(url, {
        headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" },
        signal: AbortSignal.timeout(8_000)
    });
    await observeProviderResponse(response, observe);
    if (!response.ok) throw new Error(`Unsplash returned ${response.status}`);
    const body = objectValue(await readJson(response));
    const photo = objectValue(Array.isArray(body.results) ? body.results[0] : undefined);
    const urls = objectValue(photo.urls);
    const user = objectValue(photo.user);
    const links = objectValue(photo.links);
    const imageUrl = stringValue(urls.regular);
    return imageUrl
        ? {
              id: stringValue(photo.id),
              url: imageUrl,
              alt: stringValue(photo.alt_description, `${query} travel photo`),
              photographer: stringValue(user.name, "Unsplash photographer"),
              photographerUrl: stringValue(objectValue(user.links).html),
              sourceUrl: stringValue(links.html)
          }
        : undefined;
}
