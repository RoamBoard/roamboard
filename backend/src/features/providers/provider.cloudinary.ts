import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { observeCloudinary } from "../quotas/quota.feedback.js";
import type { QuotaObserver } from "../quotas/quota.types.js";

const env = process.env;
import { AppError } from "../../shared/app-error.js";
import type { CloudinaryAsset, PhotoMetadata } from "./provider.types.js";

type MetadataObject = Record<string, unknown>;
type CloudinaryImageResult = Pick<
    UploadApiResponse,
    "public_id" | "secure_url" | "width" | "height" | "format" | "bytes" | "created_at"
> & {
    media_metadata?: unknown;
    image_metadata?: unknown;
};

function cloudinaryConfig() {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
        throw new AppError(503, "Cloudinary credentials are not configured on the API", "PROVIDER_UNAVAILABLE");
    }
    cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET
    });
    return env.CLOUDINARY_CLOUD_NAME;
}

function objectValue(value: unknown): MetadataObject {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as MetadataObject) : {};
}

function stringValue(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) return value.trim();
    return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

function coordinateValue(value: unknown, reference: unknown, maximum: number): number | null {
    if (typeof value !== "number" && typeof value !== "string") return null;
    const direct = Number(value);
    const parts = Number.isFinite(direct)
        ? [direct]
        : typeof value === "string"
          ? (value.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [])
          : [];
    if (parts.length === 0 || parts.some((part) => !Number.isFinite(part))) return null;
    const absolute = Math.abs(parts[0] ?? 0) + (parts[1] ?? 0) / 60 + (parts[2] ?? 0) / 3600;
    if (absolute > maximum) return null;
    const direction =
        stringValue(reference)?.toUpperCase().at(0) ??
        (typeof value === "string" ? value.match(/\b([NSEW])\s*$/i)?.[1]?.toUpperCase() : undefined);
    return direction === "S" || direction === "W" || (parts[0] ?? 0) < 0 ? -absolute : absolute;
}

export function normalizePhotoMetadata(value: unknown): PhotoMetadata {
    const raw = objectValue(value);
    const gps = objectValue(raw.gps ?? raw.GPS);
    const latitude = coordinateValue(
        gps.latitude ?? gps.Latitude ?? raw.GPSLatitude ?? raw.latitude ?? raw.Latitude,
        gps.latitude_ref ?? gps.LatitudeRef ?? raw.GPSLatitudeRef,
        90
    );
    const longitude = coordinateValue(
        gps.longitude ?? gps.Longitude ?? raw.GPSLongitude ?? raw.longitude ?? raw.Longitude,
        gps.longitude_ref ?? gps.LongitudeRef ?? raw.GPSLongitudeRef,
        180
    );
    const make = stringValue(raw.Make ?? raw.make);
    const model = stringValue(raw.Model ?? raw.model ?? raw.CameraModel);
    return {
        capturedAt: stringValue(
            raw.DateTimeOriginal ??
                raw.CreateDate ??
                raw.DateCreated ??
                raw.CaptureDate ??
                raw.DateTime ??
                raw.ModifyDate
        ),
        camera: [make, model].filter(Boolean).join(" ") || null,
        orientation: stringValue(raw.Orientation),
        latitude,
        longitude,
        hasGps: latitude !== null && longitude !== null,
        raw
    };
}

function assetFromUpload(result: CloudinaryImageResult, cloudName: string): CloudinaryAsset {
    const embeddedMetadata = result.media_metadata ?? result.image_metadata;
    return {
        publicId: result.public_id,
        url: `https://res.cloudinary.com/${cloudName}/image/upload/q_auto,f_auto/${result.public_id}`,
        thumbnailUrl: `https://res.cloudinary.com/${cloudName}/image/upload/c_fill,w_480,h_320,q_auto,f_auto/${result.public_id}`,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        createdAt: result.created_at,
        ...(embeddedMetadata === undefined ? {} : { metadata: normalizePhotoMetadata(embeddedMetadata) })
    };
}

export async function uploadCloudinaryImage(file: {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
}): Promise<CloudinaryAsset> {
    const cloudName = cloudinaryConfig();
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "roamboard/provider-lab",
                resource_type: "image",
                allowed_formats: ["jpg", "jpeg", "png", "webp", "heic", "heif"],
                tags: ["roamboard-provider-lab"],
                media_metadata: true,
                filename_override: file.originalname
            },
            (error, uploaded) => {
                if (error || !uploaded) reject(error ?? new Error("Cloudinary upload failed"));
                else resolve(uploaded);
            }
        );
        stream.end(file.buffer);
    });
    return assetFromUpload(result, cloudName);
}

export async function loadCloudinaryAssets(observe?: QuotaObserver): Promise<CloudinaryAsset[]> {
    const cloudName = cloudinaryConfig();
    const result = await observeCloudinary(
        () =>
            cloudinary.api.resources_by_tag("roamboard-provider-lab", {
                resource_type: "image",
                max_results: 30,
                direction: "desc"
            }),
        observe
    );
    return result.resources.map((resource: CloudinaryImageResult) =>
        assetFromUpload(
            {
                public_id: resource.public_id,
                secure_url: resource.secure_url,
                width: resource.width,
                height: resource.height,
                format: resource.format,
                bytes: resource.bytes,
                created_at: resource.created_at
            },
            cloudName
        )
    );
}

export async function loadCloudinaryMetadata(publicId: string, observe?: QuotaObserver): Promise<PhotoMetadata> {
    cloudinaryConfig();
    const result = (await observeCloudinary(
        () =>
            cloudinary.api.resource(publicId, {
                resource_type: "image",
                type: "upload",
                media_metadata: true
            }),
        observe
    )) as CloudinaryImageResult;
    return normalizePhotoMetadata(result.media_metadata ?? result.image_metadata);
}
