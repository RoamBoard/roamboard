import { randomUUID } from "node:crypto";

import { AppError } from "../../shared/app-error.js";
import { canReadBoard } from "../boards/boards.service.js";
import type { BoardRepository } from "../boards/boards.types.js";
import type { UploadIntentWrite } from "../boards/boards.schemas.js";
import type { ImageProvider, ImagesRepository, ImagesService } from "./images.types.js";

const MAX_IMAGE_BYTES = 10_000_000;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const allowedFormats = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

function imageUrl(imageId: number, variant: "display" | "thumbnail"): string {
    return `/api/v1/images/${imageId}/content?variant=${variant}`;
}

export function createImagesService(
    repository: ImagesRepository,
    provider: ImageProvider,
    boards: BoardRepository
): ImagesService {
    return {
        async createIntent(userId, input: UploadIntentWrite) {
            if (input.sizeBytes > MAX_IMAGE_BYTES) {
                throw new AppError(413, "Image exceeds 10 MB", "IMAGE_TOO_LARGE");
            }
            if (!allowedTypes.has(input.contentType.toLowerCase())) {
                throw new AppError(400, "Unsupported image type", "INVALID_REQUEST");
            }
            const uploadId = randomUUID();
            const storageKey = `roamboard/${uploadId}`;
            const createdAt = new Date();
            const expiresAt = new Date(createdAt.getTime() + 60 * 60 * 1000);
            const authorization = provider.authorizeUpload(storageKey);
            await repository.createIntent({
                uploadId,
                userId,
                storageKey,
                fileName: input.fileName,
                contentType: input.contentType,
                sizeBytes: input.sizeBytes,
                createdAt,
                expiresAt,
                imageId: null
            });
            return { uploadId, ...authorization, expiresAt: expiresAt.toISOString() };
        },
        async complete(userId, uploadId) {
            const intent = await repository.findIntent(uploadId);
            if (!intent || intent.userId !== userId) {
                throw new AppError(404, "Upload not found", "NOT_FOUND");
            }
            if (intent.expiresAt <= new Date() && intent.imageId === null) {
                throw new AppError(409, "Upload authorization expired", "UPLOAD_EXPIRED");
            }
            let imageId = intent.imageId;
            if (imageId === null) {
                const asset = await provider.inspect(intent.storageKey);
                if (!asset) throw new AppError(409, "Upload not complete", "UPLOAD_NOT_READY");
                if (
                    asset.storageKey !== intent.storageKey ||
                    asset.createdAt.getTime() < intent.createdAt.getTime() - 60_000 ||
                    !allowedFormats.has(asset.format)
                ) {
                    throw new AppError(400, "Invalid uploaded image", "INVALID_REQUEST");
                }
                if (asset.byteSize > MAX_IMAGE_BYTES) {
                    throw new AppError(413, "Image exceeds 10 MB", "IMAGE_TOO_LARGE");
                }
                imageId = await repository.completeIntent(intent, asset);
            }
            const image = await repository.findImage(imageId);
            if (!image) throw new Error("Completed image could not be read");
            return {
                imageId,
                url: imageUrl(imageId, "display"),
                thumbnailUrl: imageUrl(imageId, "thumbnail"),
                capturedAt: image.capturedAt?.toISOString() ?? null,
                latitude: image.latitude,
                longitude: image.longitude
            };
        },
        async openImage(imageId, variant, userId, boardId) {
            const image = await repository.findImage(imageId);
            if (!image) throw new AppError(404, "Image not found", "NOT_FOUND");
            if (boardId !== undefined) {
                // A readable Board exposes only its owner's current profile photo through this URL.
                const access = await boards.getAccess(boardId, userId);
                if (!access || !canReadBoard(access, userId) || image.profileOwnerUserId !== access.ownerUserId) {
                    throw new AppError(404, "Image not found", "NOT_FOUND");
                }
            } else if (image.boardId === null) {
                if (image.uploaderUserId !== userId) {
                    throw new AppError(404, "Image not found", "NOT_FOUND");
                }
            } else {
                const access = await boards.getAccess(image.boardId, userId);
                if (!access || !canReadBoard(access, userId)) {
                    throw new AppError(404, "Image not found", "NOT_FOUND");
                }
            }
            return provider.openVariant(image.storageKey, variant);
        },
        async cleanupUnused() {
            const before = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const candidates = await repository.listCleanupCandidates(before, 100);
            let removed = 0;
            for (const candidate of candidates) {
                const deleteProviderAsset = () => provider.destroy(candidate.storageKey);
                if (candidate.imageId !== null) {
                    if (await repository.cleanupImage(candidate.imageId, deleteProviderAsset)) removed += 1;
                } else if (candidate.uploadId !== null) {
                    if (await repository.cleanupIntent(candidate.uploadId, deleteProviderAsset)) removed += 1;
                }
            }
            return { removed };
        }
    };
}
