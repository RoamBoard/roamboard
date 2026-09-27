import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";
import { badRequest, missingEnv } from "@/lib/http";
import { buildAutomaticVariants } from "@/lib/cloudinary-images";
import { normalizePhotoMetadata } from "@/lib/photo-metadata";

type UploadResult = {
  public_id: string;
  secure_url: string;
  version: number;
  width: number;
  height: number;
  format: string;
  bytes: number;
  created_at: string;
  media_metadata?: Record<string, unknown>;
  image_metadata?: Record<string, unknown>;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName) return missingEnv("CLOUDINARY_CLOUD_NAME");
  if (!apiKey) return missingEnv("CLOUDINARY_API_KEY");
  if (!apiSecret) return missingEnv("CLOUDINARY_API_SECRET");

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("Send one image in multipart field named file");

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await new Promise<UploadResult>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "roamboard/user-uploads",
        resource_type: "image",
        tags: ["roamboard", "roamboard-user-upload"],
        media_metadata: true,
      },
      (error, uploaded) => {
        if (error || !uploaded) reject(error ?? new Error("Upload failed"));
        else resolve(uploaded as UploadResult);
      },
    );
    stream.end(bytes);
  });

  return NextResponse.json({
    publicId: result.public_id,
    url: result.secure_url,
    version: result.version,
    cloudName,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
    createdAt: result.created_at,
    metadata: normalizePhotoMetadata(result.media_metadata ?? result.image_metadata),
    variants: buildAutomaticVariants(result.public_id),
  });
}
