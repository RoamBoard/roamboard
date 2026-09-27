import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";
import { badRequest, missingEnv } from "@/lib/http";
import { normalizePhotoMetadata } from "@/lib/photo-metadata";

type ExplicitResult = {
  media_metadata?: Record<string, unknown>;
  image_metadata?: Record<string, unknown>;
};

export const runtime = "nodejs";

export async function GET(request: Request) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName) return missingEnv("CLOUDINARY_CLOUD_NAME");
  if (!apiKey) return missingEnv("CLOUDINARY_API_KEY");
  if (!apiSecret) return missingEnv("CLOUDINARY_API_SECRET");

  const publicId = new URL(request.url).searchParams.get("publicId")?.trim();
  if (!publicId) return badRequest("Send a Cloudinary publicId query parameter");

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  try {
    const result = await cloudinary.uploader.explicit(publicId, {
      resource_type: "image",
      type: "upload",
      media_metadata: true,
    }) as ExplicitResult;

    return NextResponse.json({
      publicId,
      metadata: normalizePhotoMetadata(result.media_metadata ?? result.image_metadata),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not extract metadata from this Cloudinary image.", detail: String(error) },
      { status: 502 },
    );
  }
}
