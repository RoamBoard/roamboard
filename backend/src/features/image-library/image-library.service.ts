import { AppError } from "../../shared/app-error.js";
import type { LibraryInput, LibraryProvider, LibraryRepository } from "./image-library.types.js";

export function createLibraryService(repository: LibraryRepository, provider: LibraryProvider) {
    async function checkRevision(key: string, expectedRevision: number) {
        const current = await repository.find(key);
        if ((current?.revision ?? 0) !== expectedRevision) {
            throw new AppError(409, "This image changed. Reload before replacing it.", "IMAGE_REVISION_CONFLICT");
        }
    }
    return {
        list: (keys?: string[]) => repository.list(keys),
        async get(key: string) {
            const image = await repository.find(key);
            if (!image) throw new AppError(404, "Image reference was not found", "IMAGE_NOT_FOUND");
            return image;
        },
        async upload(file: Buffer, input: LibraryInput) {
            await checkRevision(input.assetKey, input.expectedRevision);
            return repository.save(input.assetKey, input.expectedRevision, await provider.upload(file, input));
        },
        async externalUnsplash(url: string, input: LibraryInput) {
            const source = new URL(url);
            if (
                source.protocol !== "https:" ||
                source.hostname !== "images.unsplash.com" ||
                source.username ||
                source.password ||
                !/^\/(?:photo|premium_photo)-\d+-[a-zA-Z0-9]+$/.test(source.pathname)
            ) {
                throw new AppError(400, "Supply a valid Unsplash image URL", "INVALID_IMAGE_URL");
            }
            await checkRevision(input.assetKey, input.expectedRevision);
            return repository.save(input.assetKey, input.expectedRevision, {
                provider: "unsplash",
                url,
                thumbnailUrl: url,
                alt: input.alt,
                credit: input.credit,
                sourceUrl: input.sourceUrl || url,
                photographerUrl: "",
                cloudinaryAssetId: null,
                cloudinaryPublicId: null,
                unsplashPhotoId: null,
                checksum: null,
                width: 0,
                height: 0
            });
        },
        async unsplash(input: { assetKey: string; expectedRevision: number; photoId: string }) {
            await checkRevision(input.assetKey, input.expectedRevision);
            return repository.save(input.assetKey, input.expectedRevision, await provider.unsplash(input.photoId));
        }
    };
}
