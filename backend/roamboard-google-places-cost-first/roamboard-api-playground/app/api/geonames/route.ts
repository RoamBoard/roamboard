import { badRequest, missingEnv, proxyJson } from "@/lib/http";

export async function GET(request: Request) {
  const username = process.env.GEONAMES_USERNAME;
  if (!username) return missingEnv("GEONAMES_USERNAME");

  const query = new URL(request.url).searchParams.get("query")?.trim();
  if (!query) return badRequest("query is required");

  const upstream = new URL("https://secure.geonames.org/searchJSON");
  upstream.searchParams.set("q", query);
  upstream.searchParams.set("maxRows", "10");
  upstream.searchParams.set("style", "FULL");
  upstream.searchParams.set("username", username);

  const response = await fetch(upstream, { next: { revalidate: 86400 } });
  return proxyJson(response);
}
