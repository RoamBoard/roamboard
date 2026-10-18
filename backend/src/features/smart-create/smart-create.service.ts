import { AppError } from "../../shared/app-error.js";
import type { ImagesRepository, UploadedImage } from "../images/images.types.js";
import type { MapboxLocation } from "../providers/provider.types.js";

export type SmartCreateResolver = (latitude: number, longitude: number) => Promise<MapboxLocation | null>;
export type PhotoSuggestion = {
    imageId: number;
    location: MapboxLocation | null;
    category: string;
    warning: string | null;
};
function distance(a: UploadedImage, b: UploadedImage): number {
    const radians = Math.PI / 180;
    const lat = (b.latitude! - a.latitude!) * radians;
    const lon = (b.longitude! - a.longitude!) * radians;
    const h =
        Math.sin(lat / 2) ** 2 +
        Math.cos(a.latitude! * radians) * Math.cos(b.latitude! * radians) * Math.sin(lon / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
function sameVisit(a: UploadedImage, b: UploadedImage): boolean {
    if (!a.capturedAt || !b.capturedAt) return false;
    return (
        a.capturedAt.toISOString().slice(0, 10) === b.capturedAt.toISOString().slice(0, 10) &&
        Math.abs(a.capturedAt.getTime() - b.capturedAt.getTime()) <= 2 * 3600000 &&
        distance(a, b) <= 100
    );
}
function category(type: string | undefined): string {
    const allowed = [
        "landmark",
        "museum",
        "restaurant",
        "cafe",
        "bar",
        "shopping",
        "park",
        "beach",
        "stay",
        "transit",
        "address",
        "neighborhood"
    ];
    return type && allowed.includes(type) ? type : "other";
}
export function createSmartCreateService(repository: ImagesRepository, resolve: SmartCreateResolver) {
    return {
        async suggest(userId: string, imageIds: number[]): Promise<{ photos: PhotoSuggestion[] }> {
            // Authorize the entire request before sending any coordinates to a provider.
            const found = repository.findImages
                ? await repository.findImages(imageIds)
                : await Promise.all(imageIds.map((id) => repository.findImage(id)));
            const images = imageIds.map((id) => found.find((image) => image?.imageId === id) ?? null);
            if (images.some((image) => !image || image.uploaderUserId !== userId))
                throw new AppError(404, "Image not found", "NOT_FOUND");
            const groups: Array<{ first: UploadedImage; suggestion: PhotoSuggestion }> = [];
            const photos: PhotoSuggestion[] = [];
            let unavailable = false;
            for (const image of images as UploadedImage[]) {
                if (image.latitude === null || image.longitude === null) {
                    photos.push({
                        imageId: image.imageId,
                        location: null,
                        category: "other",
                        warning: "No GPS metadata. Assign this photo to an activity manually."
                    });
                    continue;
                }
                const previous = groups.find((group) => sameVisit(group.first, image));
                if (previous) {
                    photos.push({ ...previous.suggestion, imageId: image.imageId });
                    continue;
                }
                let location: MapboxLocation | null = null;
                let warning: string | null = null;
                try {
                    if (!unavailable) location = await resolve(image.latitude, image.longitude);
                    if (!location)
                        warning = "Place lookup unavailable. Review the photo coordinates or choose a place manually.";
                } catch {
                    unavailable = true;
                    warning = "Place lookup unavailable. Review the photo coordinates or choose a place manually.";
                }
                const suggestion = { imageId: image.imageId, location, category: category(location?.type), warning };
                groups.push({ first: image, suggestion });
                photos.push(suggestion);
            }
            return { photos };
        }
    };
}
