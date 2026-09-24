import { badRequest, missingEnv, proxyJson } from "@/lib/http";

export async function GET(request: Request) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return missingEnv("MAPBOX_ACCESS_TOKEN");

  const params = new URL(request.url).searchParams;
  const id = params.get("id")?.trim();
  const sessionToken = params.get("sessionToken")?.trim();
  if (!id) return badRequest("A Mapbox result ID is required.");
  if (!sessionToken) return badRequest("A Search Box session token is required.");

  const upstream = new URL(`https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(id)}`);
  upstream.searchParams.set("session_token", sessionToken);
  upstream.searchParams.set("language", "en");
  upstream.searchParams.set("attribute_sets", "photos,visit,venue");
  upstream.searchParams.set("access_token", token);

  try {
    const response = await fetch(upstream, { cache: "no-store" });
    return proxyJson(response);
  } catch (error) {
    return Response.json(
      { error: "Could not retrieve the Mapbox place.", detail: String(error) },
      { status: 502 },
    );
  }
}
