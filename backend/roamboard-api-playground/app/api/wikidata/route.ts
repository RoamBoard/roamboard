import { NextResponse } from "next/server";
import { badRequest } from "@/lib/http";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("query")?.trim();
  if (!query) return badRequest("query is required");

  const searchUrl = new URL("https://www.wikidata.org/w/api.php");
  searchUrl.searchParams.set("action", "wbsearchentities");
  searchUrl.searchParams.set("search", query);
  searchUrl.searchParams.set("language", "en");
  searchUrl.searchParams.set("limit", "5");
  searchUrl.searchParams.set("format", "json");

  const headers = { "Api-User-Agent": "RoamboardStudentProject/0.1 (contact: replace@example.com)" };
  const searchResponse = await fetch(searchUrl, { headers, next: { revalidate: 86400 } });
  const searchBody = (await searchResponse.json()) as { search?: Array<{ id: string }> };
  const firstId = searchBody.search?.[0]?.id;
  const entityResponse = firstId
    ? await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${firstId}.json`, {
        headers,
        next: { revalidate: 86400 },
      })
    : null;
  const entityBody: unknown = entityResponse ? await entityResponse.json() : null;

  return NextResponse.json({ search: searchBody.search ?? [], firstEntity: entityBody });
}
