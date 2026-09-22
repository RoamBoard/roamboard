import { badRequest, missingEnv, numberParam, proxyJson } from "@/lib/http";

export async function GET(request: Request) {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) return missingEnv("FOURSQUARE_API_KEY");

  const params = new URL(request.url).searchParams;
  const query = params.get("query")?.trim();
  if (!query) return badRequest("query is required");

  const latitude = numberParam(params, "latitude", 59.3293);
  const longitude = numberParam(params, "longitude", 18.0686);
  const upstream = new URL("https://places-api.foursquare.com/places/search");
  upstream.searchParams.set("query", query);
  upstream.searchParams.set("ll", `${latitude},${longitude}`);
  upstream.searchParams.set("radius", "10000");
  upstream.searchParams.set("limit", "10");
  upstream.searchParams.set(
    "fields",
    "fsq_place_id,name,latitude,longitude,location,categories,distance",
  );

  const response = await fetch(upstream, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Places-Api-Version": "2025-06-17",
    },
    cache: "no-store",
  });

  return proxyJson(response);
}
