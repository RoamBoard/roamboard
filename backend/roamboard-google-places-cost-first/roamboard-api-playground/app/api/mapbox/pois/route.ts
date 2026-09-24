import { badRequest, missingEnv, numberParam, proxyJson } from "@/lib/http";

const categories = new Set([
  "coffee",
  "food_and_drink",
  "hotel",
  "museum",
  "park",
  "shopping",
]);

export async function GET(request: Request) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return missingEnv("MAPBOX_ACCESS_TOKEN");

  const params = new URL(request.url).searchParams;
  const category = params.get("category")?.trim() ?? "";
  if (!categories.has(category)) return badRequest("Choose one of the supported POI categories.");

  const longitude = numberParam(params, "longitude", 18.0686);
  const latitude = numberParam(params, "latitude", 59.3293);
  const limit = Math.min(Math.max(numberParam(params, "limit", 10), 1), 25);
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return badRequest("Coordinates are outside valid longitude/latitude ranges.");
  }

  const upstream = new URL(`https://api.mapbox.com/search/searchbox/v1/category/${category}`);
  upstream.searchParams.set("proximity", `${longitude},${latitude}`);
  upstream.searchParams.set("limit", String(limit));
  upstream.searchParams.set("language", "en");
  upstream.searchParams.set("access_token", token);

  try {
    const response = await fetch(upstream, { cache: "no-store" });
    return proxyJson(response);
  } catch (error) {
    return Response.json(
      { error: "Could not reach Mapbox category search.", detail: String(error) },
      { status: 502 },
    );
  }
}
