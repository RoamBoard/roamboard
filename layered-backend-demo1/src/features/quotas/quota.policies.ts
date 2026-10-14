import type { QuotaPolicy } from "./quota.types.js";

const MAPBOX_PRICING = "https://www.mapbox.com/pricing";
const GOOGLE_PRICING = "https://developers.google.com/maps/billing-and-pricing/pricing";

function monthly(
    id: string,
    provider: string,
    operation: string,
    unit: string,
    limit: number,
    sourceUrl: string,
    timeZone = "UTC"
): QuotaPolicy {
    const dailyLimit =
        id === "mapbox.map_loads" ? 1_540 : ["mapbox.geocoding", "mapbox.directions"].includes(id) ? 3_090 : undefined;
    return {
        id,
        provider,
        operation,
        unit,
        sourceUrl,
        windows: [
            { period: "month", limit, timeZone },
            ...(dailyLimit === undefined ? [] : [{ period: "day" as const, limit: dailyLimit, timeZone: "UTC" }])
        ]
    };
}

export function createQuotaPolicies(): QuotaPolicy[] {
    return [
        monthly("mapbox.map_loads", "Mapbox", "Mapbox GL JS map initialization", "map load", 49_500, MAPBOX_PRICING),
        monthly(
            "mapbox.geocoding",
            "Mapbox",
            "Temporary forward or reverse geocoding",
            "request",
            99_000,
            MAPBOX_PRICING
        ),
        monthly(
            "mapbox.permanent_geocoding",
            "Mapbox",
            "Permanent geocoding (disabled: paid from first request)",
            "request",
            0,
            MAPBOX_PRICING
        ),
        {
            id: "geoapify.geocoding",
            provider: "Geoapify",
            operation: "Stored forward/city/reverse geocoding",
            unit: "credit",
            sourceUrl: "https://www.geoapify.com/pricing/",
            windows: [
                { period: "second", limit: 2, timeZone: "UTC" },
                { period: "hour", limit: 118, timeZone: "UTC" },
                { period: "day", limit: 2_970, timeZone: "UTC" }
            ]
        },
        monthly("mapbox.directions", "Mapbox", "Directions API", "request", 99_000, MAPBOX_PRICING),
        ...[
            "search_box",
            "address_autofill",
            "matrix",
            "optimization",
            "isochrone",
            "map_matching",
            "static_images",
            "static_tiles",
            "vector_tiles",
            "raster_tiles",
            "tilequery",
            "uploads",
            "tilesets",
            "datasets",
            "boundaries",
            "navigation",
            "mobile_maps"
        ].map((endpoint) =>
            monthly(
                `mapbox.${endpoint}`,
                "Mapbox",
                `${endpoint} (disabled pending SKU review)`,
                "unit",
                0,
                MAPBOX_PRICING
            )
        ),
        monthly(
            "google.places_text_search_pro",
            "Google Maps Platform",
            "Places API Text Search Pro",
            "billable event",
            4_950,
            GOOGLE_PRICING,
            "America/Los_Angeles"
        ),
        monthly(
            "google.place_details_essentials",
            "Google Maps Platform",
            "Places API Place Details Essentials",
            "billable event",
            9_900,
            GOOGLE_PRICING,
            "America/Los_Angeles"
        ),
        {
            id: "unsplash.requests",
            provider: "Unsplash",
            operation: "JSON API requests with approved production status",
            unit: "request",
            sourceUrl: "https://unsplash.com/documentation#rate-limiting",
            windows: [{ period: "hour", limit: 990, timeZone: "UTC" }]
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
                { period: "month", limit: 297_000, timeZone: "UTC" }
            ]
        },
        {
            id: "wikipedia.action_api",
            provider: "Wikimedia",
            operation: "Unauthenticated Action API with an identified User-Agent",
            unit: "request",
            sourceUrl: "https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits",
            windows: [{ period: "minute", limit: 190, timeZone: "UTC" }]
        },
        {
            id: "cloudinary.admin",
            provider: "Cloudinary",
            operation: "Admin API on the free plan",
            unit: "request",
            sourceUrl: "https://cloudinary.com/documentation/admin_api#usage_limits",
            windows: [{ period: "hour", limit: 495, timeZone: "UTC" }]
        }
    ];
}
