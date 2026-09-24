import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";
import { badRequest, missingEnv } from "@/lib/http";

type UploadResult = {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  created_at: string;
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
      { folder: "roamboard/trip-photos", resource_type: "image" },
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
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
    createdAt: result.created_at,
  });
}
