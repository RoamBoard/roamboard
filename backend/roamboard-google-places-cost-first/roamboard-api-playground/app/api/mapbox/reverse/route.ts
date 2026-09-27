import { badRequest, missingEnv, numberParam, proxyJson } from "@/lib/http";

export async function GET(request: Request) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return missingEnv("MAPBOX_ACCESS_TOKEN");

  const params = new URL(request.url).searchParams;
  const latitude = numberParam(params, "latitude", 59.3293);
  const longitude = numberParam(params, "longitude", 18.0686);
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return badRequest("Coordinates are outside valid longitude/latitude ranges.");
  }
  const upstream = new URL("https://api.mapbox.com/search/geocode/v6/reverse");
  upstream.searchParams.set("latitude", String(latitude));
  upstream.searchParams.set("longitude", String(longitude));
  upstream.searchParams.set("language", "en");
  upstream.searchParams.set("access_token", token);

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
