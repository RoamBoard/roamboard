import { toCountryCode } from "../../shared/countries.js";
import type {
    DestinationArticle,
    DestinationImage,
    DestinationResult,
    DestinationWeather
} from "./destination.types.js";

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

async function readJson(response: Response): Promise<unknown> {
    const body = await response.text();
    return body ? (JSON.parse(body) as unknown) : {};
}

async function requestMapbox(options: MapboxSearchOptions, limit: number, token: string): Promise<DestinationResult[]> {
    const url = new URL(
        options.poi
            ? "https://api.mapbox.com/search/searchbox/v1/forward"
            : "https://api.mapbox.com/search/geocode/v6/forward"
    );
    url.searchParams.set("q", options.query);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("language", "en");
    if (!options.poi) url.searchParams.set("autocomplete", "false");
    url.searchParams.set("access_token", token);
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
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
        const featureType = stringValue(properties.feature_type, "place");
        const context = objectValue(properties.context);
        const countryContext = objectValue(context.country);
        const placeContext = objectValue(context.place);
        const country = stringValue(countryContext.name);
        const countryCode = stringValue(countryContext.country_code).toUpperCase();
        const city = featureType === "place" ? name : stringValue(placeContext.name);
        return [
            {
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
        ];
    });
}

export function searchMapbox(query: string, limit: number, token: string): Promise<DestinationResult[]> {
    return requestMapbox({ query, poi: false }, limit, token);
}

export function searchMapboxPlaces(query: string, limit: number, token: string): Promise<DestinationResult[]> {
    return requestMapbox({ query, poi: true }, limit, token);
}

export async function fetchWeather(latitude: number, longitude: number): Promise<DestinationWeather> {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("daily", "temperature_2m_min,temperature_2m_max,precipitation_probability_max");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "5");
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
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

export async function fetchWikipedia(query: string): Promise<DestinationArticle | undefined> {
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
        headers: { "Api-User-Agent": "Roamboard/1.0 (student travel project)" },
        signal: AbortSignal.timeout(8_000)
    });
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

export async function fetchUnsplash(query: string, accessKey: string): Promise<DestinationImage | undefined> {
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", `${query} travel`);
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("per_page", "1");
    const response = await fetch(url, {
        headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" },
        signal: AbortSignal.timeout(8_000)
    });
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
