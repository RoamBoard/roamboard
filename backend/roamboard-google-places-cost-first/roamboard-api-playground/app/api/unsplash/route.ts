import { NextResponse } from "next/server";
import { badRequest, missingEnv } from "@/lib/http";

type UnsplashPhoto = {
  id: string;
  width: number;
  height: number;
  color: string | null;
  blur_hash: string | null;
  description: string | null;
  alt_description: string | null;
  urls: {
    raw: string;
    regular: string;
    small: string;
    thumb: string;
  };
  links: {
    html: string;
    download_location: string;
  };
  user: {
    name: string;
    username: string;
    links: { html: string };
  };
};

type UnsplashSearch = {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
};

const withReferral = (url: string) => {
  const link = new URL(url);
  link.searchParams.set("utm_source", "roamboard");
  link.searchParams.set("utm_medium", "referral");
  return link.toString();
};

export async function GET(request: Request) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return missingEnv("UNSPLASH_ACCESS_KEY");

  const destination = new URL(request.url).searchParams.get("query")?.trim();
  if (!destination) return badRequest("query is required");

  const upstream = new URL("https://api.unsplash.com/search/photos");
  upstream.searchParams.set("query", `${destination} travel`);
  upstream.searchParams.set("orientation", "landscape");
  upstream.searchParams.set("order_by", "relevant");
  upstream.searchParams.set("content_filter", "high");
  upstream.searchParams.set("per_page", "5");

  const response = await fetch(upstream, {
    headers: {
      Accept: "application/json",
      Authorization: `Client-ID ${accessKey}`,
      "Accept-Version": "v1",
    },
    cache: "no-store",
  });

  const raw = await response.text();
  let body: UnsplashSearch | { errors?: string[] };
  try {
    body = JSON.parse(raw) as UnsplashSearch | { errors?: string[] };
  } catch {
    return NextResponse.json(
      { error: "Unsplash returned a non-JSON response." },
      { status: response.status },
    );
  }

  if (!response.ok || !("results" in body)) {
    return NextResponse.json(
      { error: "errors" in body ? body.errors?.join(" ") : "Unsplash request failed." },
      { status: response.status },
    );
  }

  const photos = body.results.map((photo, index) => ({
    rank: index + 1,
    id: photo.id,
    width: photo.width,
    height: photo.height,
    color: photo.color ?? "#dbe3ef",
    blurHash: photo.blur_hash,
    alt: photo.alt_description ?? photo.description ?? `${destination} travel photo`,
    urls: photo.urls,
    photographer: {
      name: photo.user.name,
      username: photo.user.username,
      profileUrl: withReferral(photo.user.links.html),
    },
    unsplashUrl: withReferral(photo.links.html),
  }));

  return NextResponse.json({
    destination,
    searchQuery: `${destination} travel`,
    total: body.total,
    photos,
    quota: {
      limit: response.headers.get("x-ratelimit-limit"),
      remaining: response.headers.get("x-ratelimit-remaining"),
    },
  });
}
