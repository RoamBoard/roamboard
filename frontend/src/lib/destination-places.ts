import { findCountry } from "./countries";
import type { DestinationGuideInput, PlaceDetails } from "./destination-guides";

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Details are display-only; Board links keep the original travel-guide coordinates.
export async function loadPlaceDetails(city: DestinationGuideInput, placeId: string): Promise<PlaceDetails> {
    const params = new URLSearchParams({
        ...city,
        latitude: String(city.latitude),
        longitude: String(city.longitude),
        placeId
    });
    const response = await fetch(`${apiOrigin}/api/v1/destinations/place-details?${params}`, {
        credentials: "include",
        cache: "no-store"
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? "This sight's details could not load. Please try again.");
    return body.data;
}

// The creator receives travel-guide locations. Mapbox matches only affect map display.
export type StartingPlace = {
    provider?: "wikivoyage";
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    city: string;
    country: string;
};

export function placeSourceUrl(place: Pick<StartingPlace, "id" | "name">): string | undefined {
    const pageId = /^wikivoyage:([1-9]\d*):/.exec(place.id)?.[1];
    return pageId
        ? `https://en.wikivoyage.org/?curid=${pageId}#${encodeURIComponent(place.name.replace(/ /g, "_"))}`
        : undefined;
}

export async function matchPlace(place: StartingPlace): Promise<{ latitude: number; longitude: number } | null> {
    const { name, city, country, latitude, longitude } = place;
    const response = await fetch(`${apiOrigin}/api/v1/destinations/match-place`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, city, country, latitude, longitude })
    });
    if (!response.ok) throw new Error("Mapbox could not match this sight. Showing the travel-guide location.");
    return (await response.json()).data;
}

export function placeBoardHref(place: StartingPlace): string {
    return `/boards/new?${new URLSearchParams({
        mode: "scratch",
        placeId: place.id,
        place: place.name,
        address: place.address,
        latitude: String(place.latitude),
        longitude: String(place.longitude),
        city: place.city,
        country: place.country
    })}`;
}

// A shared URL can be changed by its reader. Ignore incomplete or invalid prefills.
export function getStartingPlace(params: Record<string, string | string[] | undefined>): StartingPlace | undefined {
    const keys = ["placeId", "place", "address", "latitude", "longitude", "city", "country"];
    if (keys.some((key) => typeof params[key] !== "string")) return;
    const place = {
        id: (params.placeId as string).trim(),
        name: (params.place as string).trim(),
        address: (params.address as string).trim(),
        city: (params.city as string).trim(),
        country: params.country as string,
        latitude: Number(params.latitude),
        longitude: Number(params.longitude)
    };
    if (
        !place.id ||
        place.id.length > 512 ||
        !place.name ||
        place.name.length > 200 ||
        place.address.length > 1000 ||
        !place.city ||
        place.city.length > 100 ||
        !findCountry(place.country) ||
        place.country.length !== 3 ||
        !(params.latitude as string).trim() ||
        !(params.longitude as string).trim() ||
        !Number.isFinite(place.latitude) ||
        Math.abs(place.latitude) > 90 ||
        !Number.isFinite(place.longitude) ||
        Math.abs(place.longitude) > 180
    )
        return;
    return place;
}
