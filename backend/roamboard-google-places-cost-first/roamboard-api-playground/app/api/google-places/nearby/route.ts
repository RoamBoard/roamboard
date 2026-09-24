import { badRequest } from "@/lib/http";
import { googlePlacesJson, googlePlacesUrl, SEARCH_PRO_MASK } from "@/lib/google-places";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const latitude = Number(params.get("latitude"));
  const longitude = Number(params.get("longitude"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return badRequest("latitude and longitude are required numbers");
  }

  const radius = Math.min(Math.max(Number(params.get("radius")) || 3000, 1), 50000);
  const maxResultCount = Math.min(Math.max(Number(params.get("maxResultCount")) || 10, 1), 20);
  const includedTypes = (params.get("includedTypes") || "restaurant")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const body = {
    includedTypes,
    maxResultCount,
    rankPreference: params.get("rankPreference") || "POPULARITY",
    locationRestriction: {
      circle: { center: { latitude, longitude }, radius },
    },
  };

  return googlePlacesJson(googlePlacesUrl("places:searchNearby"), {
    method: "POST",
    body,
    fieldMask: SEARCH_PRO_MASK,
  });
}
