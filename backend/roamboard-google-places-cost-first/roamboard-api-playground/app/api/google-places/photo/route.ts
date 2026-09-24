import { badRequest } from "@/lib/http";
import { googlePlacesJson, googlePlacesUrl } from "@/lib/google-places";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const name = params.get("name")?.trim();
  if (!name?.startsWith("places/") || !name.includes("/photos/")) {
    return badRequest("A valid Google photo resource name is required");
  }

  const maxWidthPx = Math.min(Math.max(Number(params.get("maxWidthPx")) || 900, 1), 4800);
  const upstream = googlePlacesUrl(`${name}/media`);
  upstream.searchParams.set("maxWidthPx", String(maxWidthPx));
  upstream.searchParams.set("skipHttpRedirect", "true");
  return googlePlacesJson(upstream);
}
