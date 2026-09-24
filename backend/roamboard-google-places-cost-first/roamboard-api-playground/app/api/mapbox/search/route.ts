import { badRequest, missingEnv, numberParam, proxyJson } from "@/lib/http";

export async function GET(request: Request) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return missingEnv("MAPBOX_ACCESS_TOKEN");

  const params = new URL(request.url).searchParams;
  const query = params.get("query")?.trim();
  if (!query) return badRequest("Add a non-empty query.");

  const limit = Math.min(Math.max(numberParam(params, "limit", 5), 1), 10);
  const longitude = params.get("longitude");
  const latitude = params.get("latitude");
  const upstream = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  upstream.searchParams.set("q", query);
  upstream.searchParams.set("limit", String(limit));
  upstream.searchParams.set("language", "en");
  upstream.searchParams.set("autocomplete", "false");
  upstream.searchParams.set("access_token", token);

  if (longitude && latitude && Number.isFinite(Number(longitude)) && Number.isFinite(Number(latitude))) {
    upstream.searchParams.set("proximity", `${longitude},${latitude}`);
  }

  try {
    const response = await fetch(upstream, { cache: "no-store" });
    return proxyJson(response);
  } catch (error) {
    return Response.json(
      { error: "Could not reach Mapbox Geocoding.", detail: String(error) },
      { status: 502 },
    );
  }
}
