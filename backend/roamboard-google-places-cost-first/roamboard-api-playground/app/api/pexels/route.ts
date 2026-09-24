import { badRequest, missingEnv, proxyJson } from "@/lib/http";

export async function GET(request: Request) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return missingEnv("PEXELS_API_KEY");

  const query = new URL(request.url).searchParams.get("query")?.trim();
  if (!query) return badRequest("query is required");

  const upstream = new URL("https://api.pexels.com/v1/search");
  upstream.searchParams.set("query", query);
  upstream.searchParams.set("orientation", "landscape");
  upstream.searchParams.set("per_page", "10");

  const response = await fetch(upstream, {
    headers: { Authorization: apiKey },
    next: { revalidate: 86400 },
  });
  return proxyJson(response);
}
