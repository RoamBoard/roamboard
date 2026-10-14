import type { QuotaPolicy, QuotaPeriod } from "./quota.types.js";

// Application budgets, below the providers' free allowances. Usage outside this API is not counted.
export function createQuotaPolicies(): QuotaPolicy[] {
    const policy = (id: string, limits: Array<[QuotaPeriod, number]>, timeZone = "UTC"): QuotaPolicy => ({
        id,
        provider: id.split(".")[0]!,
        operation: id,
        windows: limits.map(([period, limit]) => ({ period, limit, timeZone }))
    });
    return [
        policy("mapbox.map_loads", [
            ["month", 49500],
            ["day", 1540]
        ]),
        policy("mapbox.geocoding", [
            ["month", 99000],
            ["day", 3090]
        ]),
        policy("mapbox.directions", [
            ["month", 99000],
            ["day", 3090]
        ]),
        // Separate billing SKU; deliberately conservative until the team's allowance is confirmed.
        policy("mapbox.search_box", [
            ["month", 495],
            ["second", 9]
        ]),
        policy("geoapify.geocoding", [
            ["second", 2],
            ["hour", 118],
            ["day", 2970]
        ]),
        policy("google.places_text_search_pro", [["month", 4950]], "America/Los_Angeles"),
        policy("google.place_details_essentials", [["month", 9900]], "America/Los_Angeles"),
        policy("unsplash.requests", [["hour", 49]]),
        policy("open_meteo.forecast", [
            ["minute", 590],
            ["hour", 4950],
            ["day", 9900],
            ["month", 297000]
        ]),
        policy("wikipedia.action_api", [["minute", 190]]),
        policy("cloudinary.admin", [["hour", 495]])
    ];
}
