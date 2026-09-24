import { badRequest, missingEnv, numberParam, proxyJson } from "@/lib/http";

export async function GET(request: Request) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return missingEnv("MAPBOX_ACCESS_TOKEN");

  const params = new URL(request.url).searchParams;
  const query = params.get("query")?.trim();
  const sessionToken = params.get("sessionToken")?.trim();
  if (!query || query.length < 2) return badRequest("Enter at least two characters.");
  if (!sessionToken) return badRequest("A Search Box session token is required.");

  const limit = Math.min(Math.max(numberParam(params, "limit", 6), 1), 10);
  const longitude = params.get("longitude");
  const latitude = params.get("latitude");
  const upstream = new URL("https://api.mapbox.com/search/searchbox/v1/suggest");
  upstream.searchParams.set("q", query);
  upstream.searchParams.set("session_token", sessionToken);
  upstream.searchParams.set("limit", String(limit));
  upstream.searchParams.set("language", "en");
  upstream.searchParams.set("types", "poi,address,street,place,city,neighborhood,category");
  upstream.searchParams.set("access_token", token);

  if (longitude && latitude && Number.isFinite(Number(longitude)) && Number.isFinite(Number(latitude))) {
    upstream.searchParams.set("proximity", `${longitude},${latitude}`);
  }

  try {
    const response = await fetch(upstream, { cache: "no-store" });
    return proxyJson(response);
  } catch (error) {
    return Response.json(
      { error: "Could not reach Mapbox autocomplete.", detail: String(error) },
      { status: 502 },
    );
  }
}
