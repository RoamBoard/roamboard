import { randomUUID } from "node:crypto";
import { createImageCleanup } from "./images.cleanup.js";

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
        async copyForBoard(userId, boardId, imageId, authorizedSource) {
            // Preparation supplies its authorized snapshot to avoid rereading the entire itinerary for each photo.
            const [image, source] = await Promise.all([
                repository.findImage(imageId),
                authorizedSource ?? boards.getBoard(boardId, userId)
            ]);
            if (
                !source ||
                source.boardId !== boardId ||
                source.status !== "published" ||
                !source.savedByMe ||
                !image ||
                image.boardId !== boardId ||
                !source.images.some((item) => item.imageId === imageId)
            )
                throw new AppError(404, "Saved Board photo not found", "NOT_FOUND");
            if (!provider.copy) throw new AppError(503, "Photo copying is unavailable", "PROVIDER_UNAVAILABLE");
            const uploadId = randomUUID();
            const createdAt = new Date();
            const intent = {
                uploadId,
                userId,
                storageKey: `roamboard/${uploadId}`,
                fileName: "saved-board-photo",
                contentType: "image/jpeg",
                sizeBytes: MAX_IMAGE_BYTES,
                createdAt,
                expiresAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
                imageId: null
            };
            // Track storage targets before copying so partial failures can be cleaned up.
            await repository.createIntent(intent);
            const asset = await provider.copy(image.storageKey, intent.storageKey, image.presentationEdit);
            if (
                asset.storageKey !== intent.storageKey ||
                asset.byteSize > MAX_IMAGE_BYTES ||
                !allowedFormats.has(asset.format)
            )
                throw new AppError(400, "Invalid copied image", "INVALID_REQUEST");
            const copiedId = await repository.completeIntent(intent, {
                ...asset,
                capturedAt: null,
                latitude: null,
                longitude: null
            });
            return copiedId;
        },
        async readPresentation(userId, imageId) {
            const image = await repository.findImage(imageId);
            if (!image || image.uploaderUserId !== userId) throw new AppError(404, "Image not found", "NOT_FOUND");
            return { edit: image.presentationEdit ?? null, revision: image.presentationRevision ?? 0 };
        },
        async savePresentation(userId, imageId, revision, edit) {
            const image = await repository.findImage(imageId);
            if (!image || image.uploaderUserId !== userId) throw new AppError(404, "Image not found", "NOT_FOUND");
            if (!repository.savePresentation)
                throw new AppError(503, "Photo editing is unavailable", "PROVIDER_UNAVAILABLE");
            if (!(await repository.savePresentation(imageId, userId, revision, edit)))
                throw new AppError(
                    409,
                    "This photo was edited elsewhere. Reopen it before saving.",
                    "STALE_IMAGE_REVISION"
                );
            return { edit, revision: revision + 1 };
        },
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
        async openImage(imageId, variant, userId, boardId, profileHandle) {
            const image = await repository.findImage(imageId);
            if (!image) throw new AppError(404, "Image not found", "NOT_FOUND");
            if (variant === "original" && image.uploaderUserId !== userId)
                throw new AppError(404, "Image not found", "NOT_FOUND");
            if (profileHandle !== undefined) {
                if (!image.profileOwnerUserId || image.profileOwnerUsername !== profileHandle)
                    throw new AppError(404, "Image not found", "NOT_FOUND");
            } else if (boardId !== undefined) {
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
            try {
                return await provider.openVariant(
                    image.storageKey,
                    variant,
                    variant === "original" ? null : image.presentationEdit
                );
            } catch (error) {
                if (variant !== "large") throw error;
                return provider.openVariant(image.storageKey, "display", image.presentationEdit);
            }
        },
        ...createImageCleanup(repository, provider)
    };
}
