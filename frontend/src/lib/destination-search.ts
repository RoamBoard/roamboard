import { destinationPageHref, findDestinationPage, getDestinationPage } from "@/data/destination-atlas";
import { getDiscoverDestination } from "@/data/discover-destinations";
import { searchDestinations, type Destination } from "./destinations";

export type DestinationSelectionParams = Record<string, string | string[] | undefined>;

const identityKeys = ["country", "id", "type", "lat", "lon"] as const;

// Clean links select the primary destination; query parameters select a namesake.
export function destinationSelectionMatches(
    destination: { countryCode: string; coordinates?: { latitude: number; longitude: number } },
    placeType: string,
    params: DestinationSelectionParams
) {
    if (!identityKeys.some((key) => params[key] !== undefined)) return true;
    if (identityKeys.slice(1).every((key) => params[key] === undefined))
        return typeof params.country === "string" && params.country === destination.countryCode;
    if (identityKeys.some((key) => typeof params[key] !== "string" || !params[key]?.trim())) return false;
    if (params.country !== destination.countryCode || params.type !== placeType) return false;
    const latitude = Number(params.lat);
    const longitude = Number(params.lon);
    if (
        !Number.isFinite(latitude) ||
        Math.abs(latitude) > 90 ||
        !Number.isFinite(longitude) ||
        Math.abs(longitude) > 180
    )
        return false;
    if (!destination.coordinates) return true;

    // Provider city centers can differ from editorial centers. Never match a distant namesake.
    const radians = (degrees: number) => (degrees * Math.PI) / 180;
    const center = destination.coordinates;
    const haversine =
        Math.sin(radians(latitude - center.latitude) / 2) ** 2 +
        Math.cos(radians(latitude)) *
            Math.cos(radians(center.latitude)) *
            Math.sin(radians(longitude - center.longitude) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine))) <= 25;
}

function destinationSlug(name: string) {
    return name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "");
}

function selectionIdentity(destination: Destination) {
    return {
        country: destination.countryCode?.trim().toUpperCase() ?? "",
        id: destination.id,
        type: destination.placeType,
        lat: String(destination.latitude),
        lon: String(destination.longitude)
    };
}

function existingGuide(destination: Destination) {
    const alias = findDestinationPage(destination);
    const city =
        alias && destinationSelectionMatches(alias, "place", selectionIdentity(destination))
            ? alias
            : getDestinationPage(destinationSlug(destination.name));
    if (city) return { destination: city, type: "place", href: destinationPageHref(city) };
    const country = getDiscoverDestination(destinationSlug(destination.name));
    if (country) return { destination: country, type: "country", href: destinationPageHref(country) };
}

export function destinationSearchHref(destination: Destination, primary?: Destination) {
    const identity = selectionIdentity(destination);
    const guide = existingGuide(destination);
    const href = guide?.href ?? `/discover/destinations/${encodeURIComponent(destinationSlug(destination.name))}`;
    if (guide && destinationSelectionMatches(guide.destination, guide.type, identity)) return href;
    if (!guide) {
        if (!primary) return href;
        const sameCity =
            destinationSlug(primary.name) === destinationSlug(destination.name) &&
            destinationSelectionMatches(
                {
                    countryCode: primary.countryCode ?? "",
                    coordinates: { latitude: primary.latitude, longitude: primary.longitude }
                },
                primary.placeType,
                identity
            );
        if (
            (primary.id === destination.id &&
                primary.countryCode === destination.countryCode &&
                primary.placeType === destination.placeType) ||
            sameCity
        )
            return href;
    }
    const primaryCountry = guide?.destination.countryCode ?? primary?.countryCode;
    // Country alone is enough across borders. Within one country retain the precise selection.
    const params =
        primaryCountry && identity.country && primaryCountry !== identity.country
            ? new URLSearchParams({ country: identity.country })
            : new URLSearchParams(identity);
    return `${href}?${params}`;
}

export async function resolveDestinationSearchHref(
    destination: Destination,
    query: string,
    results: Destination[],
    signal?: AbortSignal
) {
    if (existingGuide(destination)) return destinationSearchHref(destination);
    if (destinationSlug(query.trim()) === destinationSlug(destination.name))
        return destinationSearchHref(destination, results[0]);
    try {
        // A qualified/prefix query cannot tell us which namesake owns the unqualified URL.
        const primary = (await searchDestinations(destination.name, signal))[0];
        return destinationSearchHref(destination, primary);
    } catch {
        // The default is a clean destination URL, independent of guide availability.
        return destinationSearchHref(destination);
    }
}
