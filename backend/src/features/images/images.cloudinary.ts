import { Readable } from "node:stream";

import { v2 as cloudinary } from "cloudinary";

import { AppError } from "../../shared/app-error.js";
import type { ImageProvider, ProviderAsset } from "./images.types.js";
import type { QuotaService } from "../quotas/quota.service.js";

const variants = {
    display: { width: 1600, height: 1600, crop: "limit", quality: "auto", fetch_format: "jpg" },
    thumbnail: { width: 320, height: 320, crop: "limit", quality: "auto", fetch_format: "jpg" }
} as const;

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

function gpsPart(value: unknown, ref: unknown): number | null {
    let result: number | null = null;
    if (typeof value === "number") result = value;
    else if (Array.isArray(value) && value.length >= 3) {
        const parts = value.map((part) => {
            if (typeof part === "number") return part;
            if (typeof part !== "string") return NaN;
            const fraction = /^(\d+)\/(\d+)$/.exec(part);
            return fraction ? Number(fraction[1]) / Number(fraction[2]) : Number(part);
        });
        if (parts.every(Number.isFinite)) result = parts[0]! + parts[1]! / 60 + parts[2]! / 3600;
    } else if (typeof value === "string") {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) result = numeric;
    }
    if (result === null || !Number.isFinite(result)) return null;
    if (ref === "S" || ref === "W") result = -Math.abs(result);
    return result;
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
    const meta = (raw.media_metadata ?? raw.image_metadata ?? raw.exif ?? {}) as Record<string, unknown>;
    const capturedAt = metadataDate(raw.taken_at ?? meta.DateTimeOriginal ?? meta.DateTimeDigitized ?? meta.DateTime);
    const latitude = gpsPart(meta.GPSLatitude, meta.GPSLatitudeRef);
    const longitude = gpsPart(meta.GPSLongitude, meta.GPSLongitudeRef);
    return {
        storageKey: raw.public_id,
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
                        image_metadata: true
                    });
                const raw = (await (quota ? quota.run("cloudinary.admin", inspect) : inspect())) as Record<
                    string,
                    unknown
                >;
                return parseAsset(raw);
            } catch (error) {
                if (typeof error === "object" && error !== null && "http_code" in error && error.http_code === 404)
                    return null;
                throw error;
            }
        },
        async openVariant(storageKey, variant) {
            config();
            const url = cloudinary.url(storageKey, {
                secure: true,
                sign_url: true,
                type: "authenticated",
                resource_type: "image",
                transformation: variants[variant],
                format: "jpg"
            });
            const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15000) });
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
            const result = (await cloudinary.uploader.destroy(storageKey, {
                resource_type: "image",
                type: "authenticated",
                invalidate: true
            })) as { result?: string };
            if (result.result !== "ok" && result.result !== "not found") {
                throw new Error("Cloudinary deletion failed");
            }
        }
    };
}
