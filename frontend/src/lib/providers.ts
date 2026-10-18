export type ProviderConfig = {
    mapbox: { configured: boolean };
    geoapify: { configured: boolean };
    unsplash: { configured: boolean };
    googlePlaces: { configured: boolean; billingRequired: true };
    cloudinary: { configured: boolean; cloudName?: string };
};

export type ProviderPlace = {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    types: string[];
    googleMapsUrl: string;
};

export type MapboxSearchResult = {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    placeType: string;
    context: string[];
    country: string | null;
    countryCode: string | null;
    city: string | null;
};

export type MapboxLocation = {
    id: string;
    label: string;
    detail: string;
    address?: string;
    type: string;
    latitude: number;
    longitude: number;
    country: string | null;
    countryCode: string | null;
    city: string | null;
};

export type GooglePlaceDetails = Omit<ProviderPlace, "name">;

export type SavedGooglePlaceReference = {
    placeId: string;
    savedAt: string;
};

export type ProviderPhoto = {
    id: string;
    url: string;
    thumbnailUrl: string;
    alt: string;
    photographer: string;
    photographerUrl: string;
    sourceUrl: string;
    width: number;
    height: number;
};

export type ProviderRoute = {
    profile: "walking" | "cycling" | "driving";
    distanceKm: number;
    durationMinutes: number;
    geometry: Array<[number, number]>;
};

export type PhotoMetadata = {
    capturedAt: string | null;
    camera: string | null;
    orientation: string | null;
    latitude: number | null;
    longitude: number | null;
    hasGps: boolean;
    raw: Record<string, unknown>;
};

export type CloudinaryAsset = {
    publicId: string;
    url: string;
    thumbnailUrl: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
    createdAt: string;
    metadata?: PhotoMetadata;
};

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiOrigin}${path}`, { ...init, credentials: "include" });
    const body = (await response.json()) as {
        data?: T;
        error?: { message?: string };
    };
    if (!response.ok || body.data === undefined) throw new Error(body.error?.message ?? "The provider request failed.");
    return body.data;
}

export const loadProviderConfig = () => request<ProviderConfig>("/api/v1/providers/config");

export const loadMapboxMapSession = (signal?: AbortSignal) =>
    request<{ publicToken: string }>("/api/v1/providers/mapbox/map-session", {
        signal,
        method: "POST"
    });

export const searchMapboxProvider = (query: string) =>
    request<MapboxSearchResult[]>(`/api/v1/providers/mapbox/search?q=${encodeURIComponent(query)}`);

export const searchBoardLocationProvider = (
    query: string,
    signal?: AbortSignal,
    proximity?: { latitude: number; longitude: number }
) => {
    const bias = proximity ? `&latitude=${proximity.latitude}&longitude=${proximity.longitude}` : "";
    return request<MapboxSearchResult[]>(`/api/v1/providers/locations/search?q=${encodeURIComponent(query)}${bias}`, {
        signal
    });
};
export const searchBoardMapboxProvider = searchBoardLocationProvider;

export const searchBoardDestinations = (countryCode: string, city: string) => {
    const params = new URLSearchParams({
        country: countryCode,
        city,
        limit: "5"
    });
    return request<MapboxSearchResult[]>(`/api/v1/providers/locations/destinations?${params.toString()}`);
};

export const reverseMapboxProvider = (latitude: string, longitude: string) =>
    request<MapboxLocation>(
        `/api/v1/providers/mapbox/reverse?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`
    );

export const reverseBoardLocationProvider = (latitude: string, longitude: string) =>
    request<MapboxLocation>(
        `/api/v1/providers/locations/reverse?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`
    );
export const reverseBoardMapboxProvider = reverseBoardLocationProvider;

export const routeMapboxProvider = (
    points: Array<{ latitude: number; longitude: number }>,
    profile: ProviderRoute["profile"]
) =>
    request<ProviderRoute>("/api/v1/providers/mapbox/directions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            points: points.map(({ latitude, longitude }) => ({
                latitude,
                longitude
            })),
            profile
        })
    });

// Automatic Board photos request one pool of candidates to share between the empty photo spaces.
export const searchUnsplashProvider = (query: string, limit?: number) =>
    request<ProviderPhoto[]>(
        `/api/v1/providers/unsplash/search?q=${encodeURIComponent(query)}${limit === undefined ? "" : `&limit=${limit}`}`
    );

export const searchGooglePlacesProvider = (query: string) =>
    request<ProviderPlace[]>(`/api/v1/providers/google-places/search?q=${encodeURIComponent(query)}`);

export const loadGooglePlaceDetails = (placeId: string) =>
    request<GooglePlaceDetails>(`/api/v1/providers/google-places/${encodeURIComponent(placeId)}`);

export const loadSavedGooglePlaces = () =>
    request<SavedGooglePlaceReference[]>("/api/v1/providers/google-places/saved");

export const saveGooglePlace = (placeId: string) =>
    request<SavedGooglePlaceReference>("/api/v1/providers/google-places/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId })
    });

export async function deleteSavedGooglePlace(placeId: string): Promise<void> {
    const response = await fetch(`${apiOrigin}/api/v1/providers/google-places/saved/${encodeURIComponent(placeId)}`, {
        method: "DELETE",
        credentials: "include"
    });
    if (!response.ok) {
        const body = (await response.json()) as {
            error?: { message?: string };
        };
        throw new Error(body.error?.message ?? "The saved Google Place ID could not be deleted.");
    }
}

export const buildCloudinaryDelivery = (publicId: string, width: string, height: string, crop: string) =>
    request<{ url: string }>(
        `/api/v1/providers/cloudinary/delivery?publicId=${encodeURIComponent(publicId)}&width=${encodeURIComponent(width)}&height=${encodeURIComponent(height)}&crop=${encodeURIComponent(crop)}`
    );

export async function uploadCloudinaryProvider(file: File): Promise<CloudinaryAsset> {
    const form = new FormData();
    form.append("file", file, file.name);
    const response = await fetch(`${apiOrigin}/api/v1/providers/cloudinary/upload`, {
        method: "POST",
        credentials: "include",
        body: form
    });
    const body = (await response.json()) as {
        data?: CloudinaryAsset;
        error?: { message?: string };
    };
    if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Cloudinary upload failed.");
    return body.data;
}

export const loadCloudinaryProviderAssets = () => request<CloudinaryAsset[]>("/api/v1/providers/cloudinary/assets");

export const loadCloudinaryProviderMetadata = (publicId: string) =>
    request<{ publicId: string; metadata: PhotoMetadata }>(
        `/api/v1/providers/cloudinary/metadata?publicId=${encodeURIComponent(publicId)}`
    );

export type ActivityPhotoLocation = {
    name: string;
    city?: string | null;
    country?: string | null;
    latitude: number;
    longitude: number;
};
export function findActivityPhoto(
    location: ActivityPhotoLocation,
    signal?: AbortSignal,
    select = false
): Promise<ProviderPhoto | null> {
    const body = {
        name: location.name,
        city: location.city ?? null,
        country: location.country ?? null,
        latitude: location.latitude,
        longitude: location.longitude
    };
    const params = new URLSearchParams(
        Object.entries(body)
            .filter(([, value]) => value !== null)
            .map(([key, value]) => [key, String(value)])
    );
    return request(
        "/api/v1/providers/unsplash/activity-photo" + (select ? "" : "?" + params),
        select
            ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal }
            : { signal }
    );
}

export async function searchBoardAreas(
    query: string,
    signal?: AbortSignal
): Promise<import("./destinations").Destination[]> {
    const places = await request<import("./destinations").Destination[]>(
        "/api/v1/providers/locations/areas?" + new URLSearchParams({ q: query, limit: "10" }),
        { signal }
    );
    return places
        .filter(
            (place) =>
                place.countryCode &&
                ["place", "city", "town", "village", "state", "region", "county", "country", "district"].includes(
                    place.placeType
                )
        )
        .slice(0, 5);
}
