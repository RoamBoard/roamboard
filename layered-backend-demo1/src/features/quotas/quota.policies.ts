import type { QuotaPolicy } from "./quota.types.js";

const MAPBOX_PRICING = "https://www.mapbox.com/pricing";
const GOOGLE_PRICING = "https://developers.google.com/maps/billing-and-pricing/pricing";

function monthly(id: string, provider: string, operation: string, unit: string, limit: number, sourceUrl: string, timeZone = "UTC"): QuotaPolicy {
  return { id, provider, operation, unit, sourceUrl, windows: [{ period: "month", limit, timeZone }] };
}

export function createQuotaPolicies(): QuotaPolicy[] {
  return [
    monthly("mapbox.map_loads", "Mapbox", "Mapbox GL JS map initialization", "map load", 49_500, MAPBOX_PRICING),
    monthly("mapbox.geocoding", "Mapbox", "Temporary forward or reverse geocoding", "request", 99_000, MAPBOX_PRICING),
    monthly("mapbox.directions", "Mapbox", "Directions API", "request", 99_000, MAPBOX_PRICING),
    monthly("google.places_text_search_pro", "Google Maps Platform", "Places API Text Search Pro", "billable event", 4_950, GOOGLE_PRICING, "America/Los_Angeles"),
    monthly("google.place_details_essentials", "Google Maps Platform", "Places API Place Details Essentials", "billable event", 9_900, GOOGLE_PRICING, "America/Los_Angeles"),
    {
      id: "unsplash.requests",
      provider: "Unsplash",
      operation: "JSON API requests with approved production status",
      unit: "request",
      sourceUrl: "https://unsplash.com/documentation#rate-limiting",
      windows: [{ period: "hour", limit: 990, timeZone: "UTC" }],
    },
    {
      id: "open_meteo.forecast",
      provider: "Open-Meteo",
      operation: "Non-commercial Forecast API",
      unit: "call",
      sourceUrl: "https://open-meteo.com/en/pricing",
      windows: [
        { period: "minute", limit: 590, timeZone: "UTC" },
        { period: "hour", limit: 4_950, timeZone: "UTC" },
        { period: "day", limit: 9_900, timeZone: "UTC" },
        { period: "month", limit: 297_000, timeZone: "UTC" },
      ],
    },
    {
      id: "wikipedia.action_api",
      provider: "Wikimedia",
      operation: "Unauthenticated Action API with an identified User-Agent",
      unit: "request",
      sourceUrl: "https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits",
      windows: [{ period: "minute", limit: 190, timeZone: "UTC" }],
    },
    {
      id: "cloudinary.admin",
      provider: "Cloudinary",
      operation: "Admin API on the free plan",
      unit: "request",
      sourceUrl: "https://cloudinary.com/documentation/admin_api#usage_limits",
      windows: [{ period: "hour", limit: 495, timeZone: "UTC" }],
    },
  ];
}
