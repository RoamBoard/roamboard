import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";
import { missingEnv } from "@/lib/http";
import { buildAutomaticVariants } from "@/lib/cloudinary-images";

type CloudinaryResource = {
  public_id: string;
  secure_url: string;
  version: number;
  width: number;
  height: number;
  format: string;
  bytes: number;
  created_at: string;
};

type ResourceResponse = {
  resources: CloudinaryResource[];
  next_cursor?: string;
};

export const runtime = "nodejs";

export async function GET() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName) return missingEnv("CLOUDINARY_CLOUD_NAME");
  if (!apiKey) return missingEnv("CLOUDINARY_API_KEY");
  if (!apiSecret) return missingEnv("CLOUDINARY_API_SECRET");

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  const result = await cloudinary.api.resources_by_tag("roamboard", {
    resource_type: "image",
    type: "upload",
    max_results: 30,
    direction: "desc",
  }) as ResourceResponse;

  const assets = result.resources.map((resource) => ({
    publicId: resource.public_id,
    url: resource.secure_url,
    thumbnailUrl: cloudinary.url(resource.public_id, {
      secure: true,
      transformation: [
        { crop: "fill", gravity: "auto", width: 500, height: 350 },
        { fetch_format: "auto", quality: "auto" },
      ],
    }),
    version: resource.version,
    cloudName,
    width: resource.width,
    height: resource.height,
    format: resource.format,
    bytes: resource.bytes,
    createdAt: resource.created_at,
    variants: buildAutomaticVariants(resource.public_id),
  }));

  return NextResponse.json({ assets, nextCursor: result.next_cursor ?? null });
}
