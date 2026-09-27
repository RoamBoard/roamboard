import { NextResponse } from "next/server";
import { badRequest, missingEnv } from "@/lib/http";

export async function POST(request: Request) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return missingEnv("UNSPLASH_ACCESS_KEY");

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return badRequest("A valid photo id is required");

  const response = await fetch(`https://api.unsplash.com/photos/${id}/download`, {
    headers: {
      Accept: "application/json",
      Authorization: `Client-ID ${accessKey}`,
      "Accept-Version": "v1",
    },
    cache: "no-store",
  });

  const result = (await response.json().catch(() => ({}))) as { url?: string; errors?: string[] };
  if (!response.ok) {
    return NextResponse.json(
      { error: result.errors?.join(" ") ?? "Could not register the Unsplash selection." },
      { status: response.status },
    );
  }

  return NextResponse.json({ tracked: true });
}
