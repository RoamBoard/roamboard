import { badRequest } from "@/lib/http";
import { googlePlacesJson, googlePlacesUrl } from "@/lib/google-places";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const input = params.get("input")?.trim();
  if (!input) return badRequest("input is required");

  const latitude = Number(params.get("latitude"));
  const longitude = Number(params.get("longitude"));
  const radius = Math.min(Math.max(Number(params.get("radius")) || 10000, 1), 50000);
  const includedPrimaryTypes = (params.get("includedPrimaryTypes") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const body = {
    input,
    ...(params.get("sessionToken") ? { sessionToken: params.get("sessionToken") } : {}),
    ...(params.get("languageCode") ? { languageCode: params.get("languageCode") } : {}),
    ...(params.get("regionCode") ? { regionCode: params.get("regionCode") } : {}),
    ...(includedPrimaryTypes.length ? { includedPrimaryTypes } : {}),
    ...(Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { locationBias: { circle: { center: { latitude, longitude }, radius } } }
      : {}),
  };

  return googlePlacesJson(googlePlacesUrl("places:autocomplete"), {
    method: "POST",
    body,
    fieldMask: [
      "suggestions.placePrediction.placeId",
      "suggestions.placePrediction.text",
      "suggestions.placePrediction.structuredFormat",
      "suggestions.placePrediction.types",
      "suggestions.queryPrediction.text",
    ].join(","),
  });
}
