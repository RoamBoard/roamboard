import type { DestinationResult } from "../destinations/destination.types.js";
import type { MapboxLocation } from "./provider.types.js";

function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown): string { return typeof value === "string" ? value : ""; }

async function request(url: URL, key: string): Promise<DestinationResult[]> {
  url.searchParams.set("apiKey", key);
  url.searchParams.set("lang", "en");
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Geoapify returned ${response.status}`);
  const body = object(await response.json());
  return (Array.isArray(body.features) ? body.features : []).flatMap((feature) => {
    const p = object(object(feature).properties);
    if (typeof p.lat !== "number" || typeof p.lon !== "number" || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) return [];
    const resultType = text(p.result_type);
    const city = text(p.city) || text(p.town) || text(p.village) || (resultType === "city" ? text(p.name) : "");
    const name = text(p.name) || text(p.address_line1) || city || "Pinned location";
    const code = text(p.country_code).toUpperCase();
    return [{ id: `geoapify:${text(p.place_id) || `${p.lat},${p.lon}`}`, name,
      address: text(p.formatted) || name, latitude: p.lat, longitude: p.lon,
      placeType: ["city", "town", "village"].includes(resultType) ? "place" : resultType || "place",
      context: [city, text(p.country)].filter(Boolean),
      country: text(p.country) || null, countryCode: /^[A-Z]{2}$/.test(code) ? code : null, city: city || null }];
  });
}

export async function searchGeoapify(query: string, limit: number, key: string, country?: string): Promise<DestinationResult[]> {
  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", query);
  url.searchParams.set("limit", String(limit));
  if (country) {
    url.searchParams.set("type", "city");
    url.searchParams.set("filter", `countrycode:${country.toLowerCase()}`);
  }
  const results = await request(url, key);
  return country ? results.filter((place) => place.placeType === "place" && place.countryCode === country.toUpperCase() && place.city) : results;
}

export async function reverseGeoapify(latitude: number, longitude: number, key: string): Promise<MapboxLocation> {
  const url = new URL("https://api.geoapify.com/v1/geocode/reverse");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("limit", "1");
  const [place] = await request(url, key);
  if (!place) throw new Error("Geoapify returned no valid location");
  return { id: place.id, label: place.context.join(", ") || place.name, detail: place.address,
    type: place.placeType, latitude, longitude, country: place.country, countryCode: place.countryCode, city: place.city };
}
