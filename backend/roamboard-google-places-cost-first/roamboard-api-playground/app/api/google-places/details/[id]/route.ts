import { badRequest } from "@/lib/http";
import { detailMask, googlePlacesJson, googlePlacesUrl } from "@/lib/google-places";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id?.trim()) return badRequest("A Google place ID is required");

  const searchParams = new URL(request.url).searchParams;
  const upstream = googlePlacesUrl(`places/${encodeURIComponent(id)}`);
  if (searchParams.get("languageCode")) upstream.searchParams.set("languageCode", searchParams.get("languageCode") || "");
  if (searchParams.get("regionCode")) upstream.searchParams.set("regionCode", searchParams.get("regionCode") || "");
  if (searchParams.get("sessionToken")) upstream.searchParams.set("sessionToken", searchParams.get("sessionToken") || "");

  return googlePlacesJson(upstream, { fieldMask: detailMask(searchParams.get("mode")) });
}
