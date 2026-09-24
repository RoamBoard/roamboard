import { badRequest } from "@/lib/http";
import { googlePlacesJson, googlePlacesUrl, SEARCH_PRO_MASK } from "@/lib/google-places";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("query")?.trim();
  if (!query) return badRequest("query is required");

  const latitude = Number(params.get("latitude"));
  const longitude = Number(params.get("longitude"));
  const radius = Math.min(Math.max(Number(params.get("radius")) || 10000, 1), 50000);
  const pageSize = Math.min(Math.max(Number(params.get("pageSize")) || 10, 1), 20);
  const includedType = params.get("includedType")?.trim();
  const minRating = Number(params.get("minRating"));
  const priceLevels = params.getAll("priceLevels").filter(Boolean);

  const body = {
    textQuery: query,
    pageSize,
    ...(Number.isFinite(latitude) && Number.isFinite(longitude)
      ? {
          locationBias: {
            circle: { center: { latitude, longitude }, radius },
          },
        }
      : {}),
    ...(params.get("openNow") === "true" ? { openNow: true } : {}),
    ...(Number.isFinite(minRating) && minRating > 0 ? { minRating } : {}),
    ...(includedType ? { includedType, strictTypeFiltering: params.get("strictType") === "true" } : {}),
    ...(priceLevels.length ? { priceLevels } : {}),
    ...(params.get("rankPreference") ? { rankPreference: params.get("rankPreference") } : {}),
  };

  return googlePlacesJson(googlePlacesUrl("places:searchText"), {
    method: "POST",
    body,
    fieldMask: SEARCH_PRO_MASK,
  });
}
