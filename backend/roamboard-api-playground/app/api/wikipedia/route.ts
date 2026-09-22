import { badRequest, proxyJson } from "@/lib/http";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("query")?.trim();
  if (!query) return badRequest("query is required");

  const upstream = new URL("https://en.wikipedia.org/w/api.php");
  upstream.searchParams.set("action", "query");
  upstream.searchParams.set("generator", "search");
  upstream.searchParams.set("gsrsearch", query);
  upstream.searchParams.set("gsrlimit", "5");
  upstream.searchParams.set("prop", "extracts|pageimages|coordinates|info");
  upstream.searchParams.set("inprop", "url");
  upstream.searchParams.set("exintro", "1");
  upstream.searchParams.set("explaintext", "1");
  upstream.searchParams.set("piprop", "thumbnail");
  upstream.searchParams.set("pithumbsize", "600");
  upstream.searchParams.set("format", "json");
  upstream.searchParams.set("formatversion", "2");

  const response = await fetch(upstream, {
    headers: { "Api-User-Agent": "RoamboardStudentProject/0.1 (contact: replace@example.com)" },
    next: { revalidate: 86400 },
  });
  return proxyJson(response);
}
