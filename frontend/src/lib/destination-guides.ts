import { findCountry } from "./countries";
import { destinationSelectionMatches } from "./destination-search";
import type { Destination } from "./destinations";
import type { ProviderPhoto } from "./providers";

export type DestinationGuideInput = {
    kind?: "country";
    name: string;
    country: string;
    latitude: number;
    longitude: number;
};

export type CityTip = { title: string; text: string; url: string };
export type PlaceDetails = {
    placeId: string;
    description: string | null;
    sourceUrl: string;
    image: {
        url: string;
        alt: string;
        width: number;
        height: number;
        author: string;
        sourceUrl: string;
        licenseName: string;
        licenseUrl: string;
    } | null;
    unavailable: ("description" | "image")[];
};

export type DestinationBoardSummary = {
    boardId: number;
    username: string;
    title: string;
    description: string | null;
    durationDays: number;
    tags: string[];
    activityTitles: string[];
    images: {
        url: string;
        alt: string;
        photographer?: string;
        photographerUrl?: string;
        sourceUrl?: string;
    }[];
};

export type DestinationGuideData = {
    cityTip: CityTip | null;
    destination: {
        kind?: "country";
        name: string;
        country: string;
        countryCode: string;
        latitude: number;
        longitude: number;
    };
    article: { title: string; description: string; url: string } | null;
    images: ProviderPhoto[];
    places: {
        provider?: "wikivoyage";
        id: string;
        name: string;
        address: string;
        latitude: number;
        longitude: number;
    }[];
    boards: DestinationBoardSummary[];
    page: number;
    hasMore: boolean;
    unavailable: ("description" | "images" | "boards" | "places" | "cityTip")[];
};

// These shortcuts preserve existing links. Search results can open other cities and countries too.
export const featuredDestinationGuides = [
    { slug: "kyoto", name: "Kyoto", country: "JPN", latitude: 35.0116, longitude: 135.7681 },
    { slug: "paris", name: "Paris", country: "FRA", latitude: 48.8566, longitude: 2.3522 },
    { slug: "copenhagen", name: "Copenhagen", country: "DNK", latitude: 55.6761, longitude: 12.5683 }
];

type SearchParams = Record<string, string | string[] | undefined>;

// Resize the returned Unsplash hotlink for its display slot, retaining its tracking parameters.
export function destinationPhotoUrl(value: string, width = 3200): string {
    if (!value.startsWith("https://images.unsplash.com/")) return value;
    const url = new URL(value);
    url.searchParams.set("w", String(width));
    url.searchParams.set("q", "85");
    url.searchParams.set("fit", "max");
    url.searchParams.set("auto", "format");
    url.searchParams.delete("h");
    url.searchParams.delete("dpr");
    return url.toString();
}

export function getDestinationGuideInput(slug: string, params: SearchParams = {}): DestinationGuideInput | undefined {
    if (params.kind !== undefined && params.kind !== "country") return undefined;
    const fields = ["name", "country", "latitude", "longitude"];
    if (params.name === undefined && params.latitude === undefined && params.longitude === undefined) {
        if (params.kind !== undefined) return undefined;
        const shortcut = featuredDestinationGuides.find((destination) => destination.slug === slug);
        if (!shortcut) return undefined;
        // Existing city links use country/id/type/lat/lon. Keep their namesake checks.
        if (!destinationSelectionMatches({ countryCode: shortcut.country, coordinates: shortcut }, "place", params))
            return undefined;
        const { name, country, latitude, longitude } = shortcut;
        return { name, country, latitude, longitude };
    }
    if (fields.some((field) => typeof params[field] !== "string" || !params[field]?.trim())) return undefined;
    const name = (params.name as string).trim();
    const country = (params.country as string).trim().toUpperCase();
    const latitude = Number(params.latitude);
    const longitude = Number(params.longitude);
    if (
        name.length > 100 ||
        country.length !== 3 ||
        !findCountry(country) ||
        !Number.isFinite(latitude) ||
        Math.abs(latitude) > 90 ||
        !Number.isFinite(longitude) ||
        Math.abs(longitude) > 180
    )
        return undefined;
    return { name, country, latitude, longitude, ...(params.kind === "country" ? { kind: "country" as const } : {}) };
}

export function destinationGuideHref(destination: Destination): string | undefined {
    // POIs and neighborhoods keep the Home brief instead of becoming destination guides.
    if (!["place", "city", "country"].includes(destination.placeType) || !destination.countryCode) return undefined;
    const input = getDestinationGuideInput("", {
        name: destination.name,
        country: destination.countryCode,
        latitude: String(destination.latitude),
        longitude: String(destination.longitude),
        ...(destination.placeType === "country" ? { kind: "country" } : {})
    });
    if (!input) return undefined;
    const slug = encodeURIComponent(input.name.toLowerCase().replace(/\s+/g, "-"));
    return `/discover/destinations/${slug}?${new URLSearchParams({
        name: input.name,
        country: input.country,
        latitude: String(input.latitude),
        longitude: String(input.longitude),
        ...(input.kind ? { kind: input.kind } : {})
    })}`;
}

export async function loadDestinationGuide(input: DestinationGuideInput, page = 1, signal?: AbortSignal) {
    const params = new URLSearchParams({
        name: input.name,
        country: input.country,
        latitude: String(input.latitude),
        longitude: String(input.longitude),
        page: String(page),
        limit: "6"
    });
    if (input.kind) params.set("kind", input.kind);
    const origin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const response = await fetch(`${origin}/api/v1/destinations/guide?${params}`, {
        credentials: "include",
        cache: "no-store",
        signal
    });
    const body = (await response.json()) as { data?: DestinationGuideData; error?: { message?: string } };
    if (!response.ok || !body.data) throw new Error(body.error?.message ?? "This destination could not be loaded.");
    return body.data;
}
