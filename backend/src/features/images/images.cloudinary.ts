import { Readable } from "node:stream";

import { v2 as cloudinary } from "cloudinary";
import { observeCloudinary } from "../quotas/quota.feedback.js";

import { cloudinaryPhotoMetadata } from "./photo-metadata.js";
import { AppError } from "../../shared/app-error.js";
import type { ImageProvider, ProviderAsset } from "./images.types.js";
import type { QuotaService } from "../quotas/quota.service.js";
import type { ImagePresentationEdit } from "./images.schemas.js";

const variants = {
    large: { width: 4096, height: 4096, crop: "limit", quality: "auto", fetch_format: "jpg" },
    display: { width: 1600, height: 1600, crop: "limit", quality: "auto", fetch_format: "jpg" },
    thumbnail: { width: 320, height: 320, crop: "limit", quality: "auto", fetch_format: "jpg" }
} as const;

function presentationSteps(edit?: ImagePresentationEdit | null) {
    return edit
        ? [
              {
                  crop: "crop",
                  x: edit.x.toFixed(6),
                  y: edit.y.toFixed(6),
                  width: edit.width.toFixed(6),
                  height: edit.height.toFixed(6)
              },
              { crop: "limit", width: edit.outputWidth, height: edit.outputHeight }
          ]
        : [];
}

interface CloudinaryConfig {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
}

function config(): CloudinaryConfig {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !/^[a-zA-Z0-9_-]+$/.test(cloudName) || !apiKey || !apiSecret) {
        throw new AppError(503, "Image storage is not configured", "IMAGE_STORAGE_UNAVAILABLE");
    }
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    return { cloudName, apiKey, apiSecret };
}

function metadataDate(value: unknown): Date | null {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const raw = String(value);
    const exif = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(raw);
    const date = new Date(exif ? `${exif[1]}-${exif[2]}-${exif[3]}T${exif[4]}Z` : raw);
    return Number.isNaN(date.getTime()) ? null : date;
}

function parseAsset(raw: Record<string, unknown>): ProviderAsset | null {
    if (
        typeof raw.public_id !== "string" ||
        raw.type !== "authenticated" ||
        raw.resource_type !== "image" ||
        typeof raw.format !== "string" ||
        typeof raw.bytes !== "number"
    )
        return null;
    const createdAt = metadataDate(raw.created_at);
    if (!createdAt) return null;
    const { capturedAt, latitude, longitude } = cloudinaryPhotoMetadata(raw);
    return {
        storageKey: raw.public_id,
        width: typeof raw.width === "number" && raw.width > 0 ? raw.width : undefined,
        height: typeof raw.height === "number" && raw.height > 0 ? raw.height : undefined,
        originalFilename: typeof raw.original_filename === "string" ? raw.original_filename : undefined,
        format: raw.format.toLowerCase(),
        byteSize: raw.bytes,
        createdAt,
        capturedAt,
        latitude: latitude !== null && Math.abs(latitude) <= 90 ? latitude : null,
        longitude: longitude !== null && Math.abs(longitude) <= 180 ? longitude : null
    };
}

export function createCloudinaryProvider(quota?: QuotaService): ImageProvider {
    return {
        async copy(sourceKey, targetKey, edit) {
            config();
            // Copy only the displayed crop. A readable Board does not grant access to its uploader's original.
            const source = cloudinary.url(sourceKey, {
                secure: true,
                sign_url: true,
                type: "authenticated",
                resource_type: "image",
                transformation: [...presentationSteps(edit), variants.display],
                format: "jpg"
            });
            const raw = await cloudinary.uploader
                .upload(source, {
                    public_id: targetKey,
                    type: "authenticated",
                    resource_type: "image",
                    overwrite: false,
                    transformation: [{ flags: "force_strip" }],
                    allowed_formats: ["jpg", "jpeg", "png", "webp", "heic", "heif"],
                    timeout: 120000
                })
                .catch(() => {
                    throw new AppError(503, "Photo could not be copied. Try again.", "PROVIDER_UNAVAILABLE");
                });
            const asset = parseAsset(raw);
            if (!asset) throw new AppError(503, "Photo could not be copied", "PROVIDER_UNAVAILABLE");
            return asset;
        },
        authorizeUpload(storageKey) {
            const { cloudName, apiKey, apiSecret } = config();
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const signed = {
                timestamp,
                public_id: storageKey,
                type: "authenticated",
                overwrite: "false",
                allowed_formats: "jpg,jpeg,png,webp,heic,heif",
                eager: `${cloudinary.utils.generate_transformation_string(variants.display)}|${cloudinary.utils.generate_transformation_string(variants.thumbnail)}`
            };
            return {
                uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
                method: "POST",
                headers: {},
                formFields: {
                    ...signed,
                    api_key: apiKey,
                    signature: cloudinary.utils.api_sign_request(signed, apiSecret)
                }
            };
        },
        async inspect(storageKey) {
            config();
            try {
                const inspect = () =>
                    cloudinary.api.resource(storageKey, {
                        resource_type: "image",
                        type: "authenticated",
                        media_metadata: true
                    });
                const raw = (await (quota
                    ? quota.run("cloudinary.admin", (observe) => observeCloudinary(inspect, observe))
                    : inspect())) as Record<string, unknown>;
                return parseAsset(raw);
            } catch (error) {
                const metadata =
                    typeof error === "object" && error !== null
                        ? (error as { http_code?: number; error?: { http_code?: number } })
                        : {};
                if ((metadata.http_code ?? metadata.error?.http_code) === 404) return null;
                throw error;
            }
        },
        async openVariant(storageKey, variant, edit) {
            config();
            const url = cloudinary.url(storageKey, {
                secure: true,
                sign_url: true,
                type: "authenticated",
                resource_type: "image",
                transformation: [
                    ...(variant !== "original" ? presentationSteps(edit) : []),
                    variant === "original"
                        ? { width: 4096, height: 4096, crop: "limit", quality: "auto", fetch_format: "jpg" }
                        : variants[variant]
                ],
                format: "jpg"
            });
            const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15000) });
            if (response.status === 404) {
                await response.body?.cancel();
                throw new AppError(
                    404,
                    "The saved image file is missing from storage. Restore or re-upload the original image.",
                    "IMAGE_ASSET_MISSING"
                );
            }
            if (!response.ok || !response.body || !response.headers.get("content-type")?.startsWith("image/jpeg")) {
                throw new AppError(502, "Image delivery failed", "IMAGE_DELIVERY_FAILED");
            }
            return {
                stream: Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
                contentType: "image/jpeg"
            };
        },
        async destroy(storageKey) {
            config();
            // The SDK supports timeout at runtime, although destroy's declaration omits it.
            const options = {
                timeout: 15000,
                resource_type: "image" as const,
                type: "authenticated" as const,
                invalidate: true
            };
            const result = (await cloudinary.uploader.destroy(storageKey, options)) as { result?: string };
            if (result.result !== "ok" && result.result !== "not found") {
                throw new Error("Cloudinary deletion failed");
            }
        }
    };
}
