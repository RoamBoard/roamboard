import { missingEnv, proxyJson } from "@/lib/http";
import { NextResponse } from "next/server";

const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1/";

// Search endpoints are deliberately locked to Pro fields. A query parameter
// cannot silently add Enterprise/Atmosphere fields and raise the SKU.
export const SEARCH_PRO_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryType",
  "places.googleMapsUri",
].join(",");

export const detailFieldMasks = {
  basic: [
    "id",
    "displayName",
    "formattedAddress",
    "location",
    "primaryType",
    "businessStatus",
    "googleMapsUri",
    "utcOffsetMinutes",
  ].join(","),
  rich: [
    "id",
    "displayName",
    "formattedAddress",
    "location",
    "primaryType",
    "businessStatus",
    "googleMapsUri",
    "utcOffsetMinutes",
    "rating",
    "userRatingCount",
    "priceLevel",
    "currentOpeningHours",
    "websiteUri",
    "nationalPhoneNumber",
    "photos",
  ].join(","),
} as const;

export function googlePlacesUrl(path: string) {
  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(`${GOOGLE_PLACES_BASE_URL}${normalizedPath}`);
}

export function googlePlacesKey() {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() || null;
}

export async function googlePlacesJson(
  url: URL,
  options: { method?: "GET" | "POST"; body?: unknown; fieldMask?: string } = {},
) {
  const apiKey = googlePlacesKey();
  if (!apiKey) return missingEnv("GOOGLE_PLACES_API_KEY");

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        ...(options.fieldMask ? { "X-Goog-FieldMask": options.fieldMask } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      cache: "no-store",
    });

    return proxyJson(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not reach Google Places.",
        detail: error instanceof Error ? error.message : String(error),
        hint: "Check the terminal, internet connection, API key, billing, API restrictions and Places API (New) status.",
      },
      { status: 502 },
    );
  }
}

export function detailMask(mode: string | null) {
  return mode === "rich" ? detailFieldMasks.rich : detailFieldMasks.basic;
}
