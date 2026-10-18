import type { DestinationResult } from "../destinations/destination.types.js";
import type { AreaSuggestionRequest } from "./provider.schemas.js";
const distance = (a: AreaSuggestionRequest["points"][number], b: AreaSuggestionRequest["points"][number]) => {
    const r = Math.PI / 180;
    const h =
        Math.sin(((a.latitude - b.latitude) * r) / 2) ** 2 +
        Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(((a.longitude - b.longitude) * r) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
};
export async function suggestActivityArea(
    input: AreaSuggestionRequest,
    resolve: (
        point: AreaSuggestionRequest["points"][number],
        type: "city" | "state"
    ) => Promise<DestinationResult | null>
) {
    const groups = input.points.map((point) =>
        input.points.filter(
            (other) =>
                (!point.country || !other.country || point.country === other.country) && distance(point, other) <= 120
        )
    );
    const cluster = groups.reduce(
        (best, next) => (next.length > best.length ? next : best),
        [] as AreaSuggestionRequest["points"]
    );
    if (cluster.length < 3 || cluster.length / input.points.length < 0.6) return null;
    const point = cluster.reduce((best, next) =>
        cluster.reduce((sum, p) => sum + distance(next, p), 0) < cluster.reduce((sum, p) => sum + distance(best, p), 0)
            ? next
            : best
    );
    const cities = new Set(cluster.map((p) => p.city?.trim().toLowerCase()).filter(Boolean));
    return resolve(point, cities.size > 1 || cluster.some((p) => distance(point, p) > 25) ? "state" : "city");
}
