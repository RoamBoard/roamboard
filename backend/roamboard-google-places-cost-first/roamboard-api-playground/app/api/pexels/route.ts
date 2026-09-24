import { badRequest, missingEnv, numberParam } from "@/lib/http";

const modes = new Set(["search", "curated", "videos"]);
const orientations = new Set(["", "landscape", "portrait", "square"]);
const sizes = new Set(["", "large", "medium", "small"]);
const namedColors = new Set([
  "red", "orange", "yellow", "green", "turquoise", "blue", "violet",
  "pink", "brown", "black", "gray", "white",
]);

function validColor(value: string) {
  return value === "" || namedColors.has(value) || /^[0-9a-fA-F]{6}$/.test(value);
}

export async function GET(request: Request) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return missingEnv("PEXELS_API_KEY");

  const params = new URL(request.url).searchParams;
  const mode = params.get("mode") ?? "search";
  const query = params.get("query")?.trim() ?? "";
  const orientation = params.get("orientation") ?? "landscape";
  const size = params.get("size") ?? "";
  const color = params.get("color")?.replace(/^#/, "") ?? "";
  const page = Math.max(Math.floor(numberParam(params, "page", 1)), 1);
  const perPage = Math.min(Math.max(Math.floor(numberParam(params, "perPage", 12)), 1), 30);

  if (!modes.has(mode)) return badRequest("mode must be search, curated, or videos");
  if (mode !== "curated" && !query) return badRequest("query is required for photo and video search");
  if (!orientations.has(orientation)) return badRequest("Invalid orientation");
  if (!sizes.has(size)) return badRequest("Invalid size");
  if (!validColor(color)) return badRequest("Use a supported color name or a six-character hex color");

  const endpoint = mode === "curated"
    ? "https://api.pexels.com/v1/curated"
    : mode === "videos"
      ? "https://api.pexels.com/v1/videos/search"
      : "https://api.pexels.com/v1/search";
  const upstream = new URL(endpoint);

  if (mode !== "curated") upstream.searchParams.set("query", query);
  upstream.searchParams.set("page", String(page));
  upstream.searchParams.set("per_page", String(perPage));
  if (orientation) upstream.searchParams.set("orientation", orientation);
  if (size) upstream.searchParams.set("size", size);
  if (color && mode === "search") upstream.searchParams.set("color", color);

  try {
    const response = await fetch(upstream, {
      headers: { Authorization: apiKey },
      cache: "no-store",
    });
    const raw = await response.text();
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) as unknown : {};
    } catch {
      body = { error: "Pexels returned non-JSON data", preview: raw.slice(0, 300) };
    }

    const quota = {
      limit: response.headers.get("x-ratelimit-limit"),
      remaining: response.headers.get("x-ratelimit-remaining"),
      reset: response.headers.get("x-ratelimit-reset"),
    };
    return Response.json({ data: body, quota }, { status: response.status });
  } catch (error) {
    return Response.json(
      { error: "Could not reach Pexels.", detail: String(error) },
      { status: 502 },
    );
  }
}
