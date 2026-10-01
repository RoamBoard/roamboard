import type { GooglePlaceDetails, MapboxLocation, ProviderPhoto, ProviderPlace, ProviderRoute, RoutePoint, RouteProfile } from "./provider.types.js";

type JsonObject = Record<string, unknown>;

function objectValue(value: unknown): JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  return text ? JSON.parse(text) as unknown : {};
}

export function googleMapsPlaceUrl(placeId: string, query: string): string {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", query || "Google place");
  url.searchParams.set("query_place_id", placeId);
  return url.toString();
}

function contextName(context: JsonObject, key: string): string {
  return stringValue(objectValue(context[key]).name);
}

function uniqueNames(values: string[]): string[] {
  return values.filter((value, index) => value && values.findIndex((candidate) => candidate.toLocaleLowerCase() === value.toLocaleLowerCase()) === index);
}

export async function reverseMapbox(latitude: number, longitude: number, token: string): Promise<MapboxLocation> {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/reverse");
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("language", "en");
  url.searchParams.set("access_token", token);
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Mapbox returned ${response.status}`);
  const body = objectValue(await readJson(response));
  const first = Array.isArray(body.features) ? objectValue(body.features[0]) : {};
  const properties = objectValue(first.properties);
  const context = objectValue(properties.context);
  const type = stringValue(properties.feature_type, "location");
  const name = stringValue(properties.name_preferred ?? properties.name, "Pinned location");
  const featureName = (featureType: string) => type === featureType ? name : contextName(context, featureType);
  const area = featureName("neighborhood") || featureName("locality") || featureName("district");
  const place = featureName("place");
  const country = featureName("country");
  const label = uniqueNames([area || place || name, place, country]).join(", ");
  const detail = [area, place, country].some((value) => value.toLocaleLowerCase() === name.toLocaleLowerCase()) ? "" : name;
  return {
    id: stringValue(first.id ?? properties.mapbox_id, `mapbox-${latitude}-${longitude}`),
    label: label || name,
    detail,
    type,
    latitude,
    longitude,
  };
}

export async function searchUnsplash(query: string, accessKey: string, limit: number): Promise<ProviderPhoto[]> {
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("per_page", String(limit));
  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Unsplash returned ${response.status}`);
  const body = objectValue(await readJson(response));
  const photos = Array.isArray(body.results) ? body.results : [];
  return photos.flatMap((value) => {
    const photo = objectValue(value);
    const urls = objectValue(photo.urls);
    const links = objectValue(photo.links);
    const user = objectValue(photo.user);
    const userLinks = objectValue(user.links);
    const urlValue = stringValue(urls.regular);
    if (!urlValue) return [];
    return [{
      id: stringValue(photo.id),
      url: urlValue,
      thumbnailUrl: stringValue(urls.small, urlValue),
      alt: stringValue(photo.alt_description, `${query} travel photo`),
      photographer: stringValue(user.name, "Unsplash photographer"),
      photographerUrl: stringValue(userLinks.html),
      sourceUrl: stringValue(links.html),
      width: numberValue(photo.width) ?? 0,
      height: numberValue(photo.height) ?? 0,
    }];
  });
}

export async function searchGooglePlaces(query: string, apiKey: string, limit: number): Promise<ProviderPlace[]> {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types",
    },
    body: JSON.stringify({ textQuery: query, pageSize: limit, languageCode: "en" }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Google Places returned ${response.status}`);
  const body = objectValue(await readJson(response));
  const places = Array.isArray(body.places) ? body.places : [];
  return places.flatMap((value) => {
    const place = objectValue(value);
    const location = objectValue(place.location);
    const displayName = objectValue(place.displayName);
    const latitude = numberValue(location.latitude);
    const longitude = numberValue(location.longitude);
    const id = stringValue(place.id);
    if (!id || latitude === undefined || longitude === undefined) return [];
    const name = stringValue(displayName.text, "Unnamed place");
    const address = stringValue(place.formattedAddress, "Address unavailable");
    return [{
      id,
      name,
      address,
      latitude,
      longitude,
      types: Array.isArray(place.types) ? place.types.filter((item): item is string => typeof item === "string") : [],
      googleMapsUrl: googleMapsPlaceUrl(id, name === "Unnamed place" ? address : name),
    }];
  });
}

export async function fetchGooglePlaceDetails(placeId: string, apiKey: string): Promise<GooglePlaceDetails> {
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,formattedAddress,location,types",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Google Places returned ${response.status}`);
  const place = objectValue(await readJson(response));
  const location = objectValue(place.location);
  const latitude = numberValue(location.latitude);
  const longitude = numberValue(location.longitude);
  if (latitude === undefined || longitude === undefined) throw new Error("Google Places returned no location");
  const id = stringValue(place.id, placeId);
  const address = stringValue(place.formattedAddress, "Address unavailable");
  return {
    id,
    address,
    latitude,
    longitude,
    types: Array.isArray(place.types) ? place.types.filter((item): item is string => typeof item === "string") : [],
    googleMapsUrl: googleMapsPlaceUrl(id, address),
  };
}

export async function routeMapbox(points: RoutePoint[], profile: RouteProfile, token: string): Promise<ProviderRoute> {
  const coordinates = points.map((point) => `${point.longitude},${point.latitude}`).join(";");
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("access_token", token);
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Mapbox returned ${response.status}`);
  const body = objectValue(await readJson(response));
  const route = objectValue(Array.isArray(body.routes) ? body.routes[0] : undefined);
  const distance = numberValue(route.distance);
  const duration = numberValue(route.duration);
  const geometry = objectValue(route.geometry);
  const coordinatesValue = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
  if (distance === undefined || duration === undefined || coordinatesValue.length === 0) throw new Error("Mapbox returned no route");
  return {
    profile,
    distanceKm: Math.round((distance / 1000) * 10) / 10,
    durationMinutes: Math.round(duration / 60),
    geometry: coordinatesValue.flatMap((value) => {
      if (!Array.isArray(value) || typeof value[0] !== "number" || typeof value[1] !== "number") return [];
      return [[value[0], value[1]] as [number, number]];
    }),
  };
}
