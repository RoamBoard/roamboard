import { badRequest, missingEnv, proxyJson } from "@/lib/http";

export async function GET(request: Request) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return missingEnv("UNSPLASH_ACCESS_KEY");

  const query = new URL(request.url).searchParams.get("query")?.trim();
  if (!query) return badRequest("query is required");

  const upstream = new URL("https://api.unsplash.com/search/photos");
  upstream.searchParams.set("query", query);
  upstream.searchParams.set("orientation", "landscape");
  upstream.searchParams.set("per_page", "10");

  const response = await fetch(upstream, {
    headers: {
      Accept: "application/json",
      Authorization: `Client-ID ${accessKey}`,
      "Accept-Version": "v1",
    },
    next: { revalidate: 86400 },
  });
  return proxyJson(response);
}
