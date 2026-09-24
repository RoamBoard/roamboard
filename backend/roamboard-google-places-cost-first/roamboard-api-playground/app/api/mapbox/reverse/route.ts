import { missingEnv, numberParam, proxyJson } from "@/lib/http";

export async function GET(request: Request) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return missingEnv("MAPBOX_ACCESS_TOKEN");

  const params = new URL(request.url).searchParams;
  const latitude = numberParam(params, "latitude", 59.3293);
  const longitude = numberParam(params, "longitude", 18.0686);
  const upstream = new URL("https://api.mapbox.com/search/geocode/v6/reverse");
  upstream.searchParams.set("latitude", String(latitude));
  upstream.searchParams.set("longitude", String(longitude));
  upstream.searchParams.set("language", "en");
  upstream.searchParams.set("access_token", token);

  const response = await fetch(upstream, { cache: "no-store" });
  return proxyJson(response);
}
