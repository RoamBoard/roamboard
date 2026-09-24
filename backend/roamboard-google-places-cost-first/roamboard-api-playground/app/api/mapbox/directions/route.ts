import { badRequest, missingEnv, proxyJson } from "@/lib/http";

const profiles = new Set(["walking", "cycling", "driving"]);
const coordinatePattern = /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/;

export async function GET(request: Request) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return missingEnv("MAPBOX_ACCESS_TOKEN");

  const params = new URL(request.url).searchParams;
  const profile = params.get("profile") ?? "walking";
  const points = (params.get("coordinates") ?? "").split(";").filter(Boolean);

  if (!profiles.has(profile)) return badRequest("Profile must be walking, cycling, or driving.");
  if (points.length < 2 || points.length > 10 || points.some((point) => !coordinatePattern.test(point))) {
    return badRequest("Provide 2-10 coordinates as longitude,latitude pairs separated by semicolons.");
  }

  const validRanges = points.every((point) => {
    const [longitude, latitude] = point.split(",").map(Number);
    return longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
  });
  if (!validRanges) return badRequest("Coordinates are outside valid longitude/latitude ranges.");

  const upstream = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${points.join(";")}`);
  upstream.searchParams.set("alternatives", "false");
  upstream.searchParams.set("geometries", "geojson");
  upstream.searchParams.set("overview", "full");
  upstream.searchParams.set("steps", "true");
  upstream.searchParams.set("access_token", token);

  try {
    const response = await fetch(upstream, { cache: "no-store" });
    return proxyJson(response);
  } catch (error) {
    return Response.json(
      { error: "Could not reach Mapbox Directions.", detail: String(error) },
      { status: 502 },
    );
  }
}
