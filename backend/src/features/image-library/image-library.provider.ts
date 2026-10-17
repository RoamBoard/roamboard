import { createHash } from "node:crypto";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { z } from "zod";
import { AppError } from "../../shared/app-error.js";
import type { QuotaService } from "../quotas/quota.service.js";
import { observeProviderResponse } from "../quotas/quota.feedback.js";
import type { LibraryAsset, LibraryProvider } from "./image-library.types.js";

const providerUrl = (hostname: string) =>
    z.url().refine((value) => {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname === hostname && !url.username && !url.password;
    });
const unsplashPhoto = z.object({
    urls: z.object({ regular: providerUrl("images.unsplash.com"), small: providerUrl("images.unsplash.com") }),
    user: z.object({ name: z.string().min(1), links: z.object({ html: providerUrl("unsplash.com") }) }),
    links: z.object({ html: providerUrl("unsplash.com"), download_location: providerUrl("api.unsplash.com") }),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    alt_description: z.string().nullable().optional()
});

export function createLibraryProvider(quota: QuotaService): LibraryProvider {
    async function unsplashRequest(path: string): Promise<Record<string, unknown>> {
        const key = process.env.UNSPLASH_ACCESS_KEY;
        if (!key) throw new AppError(503, "Unsplash is not configured", "PROVIDER_UNAVAILABLE");
        return quota.run("unsplash.requests", async (observe) => {
            const response = await fetch(`https://api.unsplash.com${path}`, {
                headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
                redirect: "error",
                signal: AbortSignal.timeout(10000)
            }).catch(() => {
                throw new AppError(502, "Unsplash is temporarily unavailable", "UNSPLASH_PHOTO_UNAVAILABLE");
            });
            await observeProviderResponse(response, observe);
            if (!response.ok)
                throw new AppError(
                    response.status === 404 ? 404 : 502,
                    "Unsplash photo could not be loaded",
                    "UNSPLASH_PHOTO_UNAVAILABLE"
                );
            return (await response.json()) as Record<string, unknown>;
        });
    }
    return {
        async upload(file, input) {
            const {
                CLOUDINARY_CLOUD_NAME: cloudName,
                CLOUDINARY_API_KEY: apiKey,
                CLOUDINARY_API_SECRET: apiSecret
            } = process.env;
            if (!cloudName || !apiKey || !apiSecret)
                throw new AppError(503, "Cloudinary is not configured", "PROVIDER_UNAVAILABLE");
            cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
            const checksum = createHash("sha256").update(file).digest("hex");
            const result = await new Promise<UploadApiResponse>((resolve, reject) => {
                cloudinary.uploader
                    .upload_stream(
                        {
                            public_id: `roamboard/editorial/${input.assetKey}/${checksum}`,
                            overwrite: false,
                            resource_type: "image",
                            type: "upload",
                            allowed_formats: ["jpg", "jpeg", "png", "webp", "gif", "avif", "heic", "heif"],
                            tags: ["roamboard-editorial"]
                        },
                        (error, result) => {
                            if (error || !result)
                                reject(
                                    new AppError(
                                        502,
                                        "Cloudinary upload failed; the previous image is unchanged",
                                        "IMAGE_UPLOAD_FAILED"
                                    )
                                );
                            else resolve(result);
                        }
                    )
                    .end(file);
            });
            if (
                !result.asset_id ||
                !result.public_id ||
                !result.secure_url?.startsWith("https://res.cloudinary.com/")
            ) {
                throw new AppError(502, "Cloudinary returned an invalid image", "IMAGE_UPLOAD_FAILED");
            }
            return {
                provider: "cloudinary",
                url: result.secure_url,
                thumbnailUrl: result.secure_url,
                alt: input.alt,
                credit: input.credit,
                sourceUrl: input.sourceUrl,
                photographerUrl: "",
                cloudinaryAssetId: result.asset_id,
                cloudinaryPublicId: result.public_id,
                unsplashPhotoId: null,
                checksum,
                width: result.width,
                height: result.height
            };
        },
        async unsplash(photoId) {
            const photo = await unsplashRequest(`/photos/${encodeURIComponent(photoId)}`);
            const parsed = unsplashPhoto.safeParse(photo);
            if (!parsed.success) {
                throw new AppError(502, "Unsplash returned incomplete photo information", "UNSPLASH_PHOTO_UNAVAILABLE");
            }
            const { urls, user, links } = parsed.data;
            const download = new URL(links.download_location);
            if (download.pathname !== `/photos/${photoId}/download`) {
                throw new AppError(502, "Unsplash returned an invalid selection link", "UNSPLASH_PHOTO_UNAVAILABLE");
            }
            // Selecting a photo for the website is the download-equivalent event, not searching or rendering.
            await unsplashRequest(`${download.pathname}${download.search}`);
            const referral = (url: string) => {
                const value = new URL(url);
                value.searchParams.set("utm_source", "roamboard");
                value.searchParams.set("utm_medium", "referral");
                return value.toString();
            };
            return {
                provider: "unsplash",
                url: urls.regular,
                thumbnailUrl: urls.small,
                alt: typeof photo.alt_description === "string" ? photo.alt_description : "Travel photograph",
                credit: user.name,
                sourceUrl: referral(links.html),
                photographerUrl: user.links?.html ? referral(user.links.html) : "",
                cloudinaryAssetId: null,
                cloudinaryPublicId: null,
                unsplashPhotoId: photoId,
                checksum: null,
                width: Number(photo.width),
                height: Number(photo.height)
            } satisfies LibraryAsset;
        }
    };
}
