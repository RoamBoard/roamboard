import { badRequest, missingEnv, proxyJson } from "@/lib/http";

export async function GET(request: Request) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return missingEnv("GOOGLE_PLACES_API_KEY");

  const query = new URL(request.url).searchParams.get("query")?.trim();
  if (!query) return badRequest("query is required");

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.primaryType",
        "places.rating",
        "places.userRatingCount",
        "places.photos",
        "places.googleMapsUri",
      ].join(","),
    },
    body: JSON.stringify({ textQuery: query, pageSize: 10 }),
    cache: "no-store",
  });

  return proxyJson(response);
}
