import type { QuotaPolicy, QuotaPeriod } from "./quota.types.js";

// Application budgets, below the providers' free allowances. Usage outside this API is not counted.
export function createQuotaPolicies(): QuotaPolicy[] {
    const policy = (id: string, limits: Array<[QuotaPeriod, number]>, timeZone = "UTC"): QuotaPolicy => ({
        id,
        provider: id.split(".")[0]!,
        operation: id,
        windows: limits.map(([period, limit]) => ({
            period,
            limit,
            timeZone,
            // Verified billing months use their calendar boundary. Other limits
            // cover any trailing interval instead of assuming a provider timezone.
            rolling: !id.startsWith("google.") && !(id.startsWith("mapbox.") && period === "month")
        }))
    });
    return [
        policy("mapbox.map_loads", [["month", 49500]]),
        policy("mapbox.geocoding", [["month", 99000]]),
        policy("mapbox.directions", [["month", 99000]]),
        // Separate billing SKU; deliberately conservative until the team's allowance is confirmed.
        policy("mapbox.search_box", [
            ["month", 495],
            ["second", 9]
        ]),
        policy("geoapify.geocoding", [
            ["second", 2],
            ["day", 2970]
        ]),
        policy("google.places_text_search_pro", [["month", 4950]], "America/Los_Angeles"),
        policy("google.place_details_essentials", [["month", 9900]], "America/Los_Angeles"),
        policy("unsplash.requests", [["hour", 990]]),
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
