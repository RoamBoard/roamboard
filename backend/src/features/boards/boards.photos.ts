import { AppError } from "../../shared/app-error.js";
import type { ActivityPhoto, BoardActivityWrite, CoverPhoto } from "./boards.schemas.js";
import { legacyMediaPresence } from "./boards.schemas.js";

export function photoKey(photo: CoverPhoto): string {
    return photo.source === "upload" ? `upload:${photo.imageId}` : `unsplash:${photo.providerImageId}`;
}
export function legacyPhotos(activity: BoardActivityWrite): ActivityPhoto[] {
    const external = activity.externalImage;
    return [
        ...activity.uploadedImageIds.map((imageId) => ({ source: "upload" as const, imageId })),
        ...(external
            ? [
                  {
                      source: "unsplash" as const,
                      providerImageId: external.providerImageId,
                      url: external.url,
                      thumbnailUrl: "thumbnailUrl" in external ? String(external.thumbnailUrl) : external.url,
                      alt: "alt" in external ? String(external.alt) : activity.title,
                      width: "width" in external ? Number(external.width) : 1,
                      height: "height" in external ? Number(external.height) : 1,
                      photographer: external.photographer,
                      photographerUrl: external.photographerUrl,
                      sourceUrl: external.sourceUrl,
                      context: external.context
                  }
              ]
            : [])
    ];
}
export function resolveActivityPhotos(activity: BoardActivityWrite, previous?: BoardActivityWrite): BoardActivityWrite {
    if (
        activity.coverImageId !== undefined &&
        activity.coverImageId !== null &&
        !activity.uploadedImageIds.includes(activity.coverImageId)
    )
        throw new AppError(400, "Cover must be attached", "INVALID_REQUEST");
    if (
        activity.coverPhoto &&
        activity.photos &&
        !activity.photos.some((photo) => photoKey(photo) === photoKey(activity.coverPhoto!))
    )
        throw new AppError(400, "Cover must be attached", "INVALID_REQUEST");
    const old = previous?.photos ?? (previous ? legacyPhotos(previous) : []);
    const firstExternal = old.find((photo) => photo.source === "unsplash");
    const presence = activity[legacyMediaPresence];
    const legacy = legacyPhotos({
        ...activity,
        uploadedImageIds: presence?.uploads === false ? (previous?.uploadedImageIds ?? []) : activity.uploadedImageIds,
        externalImage: presence?.external === false ? (previous?.externalImage ?? null) : activity.externalImage
    });
    const uploads = legacy.filter((photo) => photo.source === "upload");
    const external = legacy.find((photo) => photo.source === "unsplash");
    const existingExternal = external ? old.find((photo) => photoKey(photo) === photoKey(external)) : undefined;
    const selectedExternal = external
        ? {
              ...existingExternal,
              ...external,
              ...(existingExternal?.source === "unsplash"
                  ? {
                        thumbnailUrl: existingExternal.thumbnailUrl,
                        alt: existingExternal.alt,
                        width: existingExternal.width,
                        height: existingExternal.height,
                        presentation: existingExternal.presentation
                    }
                  : {}),
              context:
                  external.context === undefined && existingExternal?.source === "unsplash"
                      ? (existingExternal.context ?? null)
                      : (external.context ?? null)
          }
        : null;
    const compatible = old.flatMap((photo): ActivityPhoto[] => {
        if (photo.source === "upload") {
            const next = uploads.shift();
            return next ? [next] : [];
        }
        if (photo === firstExternal) return selectedExternal ? [selectedExternal] : [];
        return [photo];
    });
    compatible.push(...uploads);
    if (!firstExternal && selectedExternal) compatible.push(selectedExternal);
    const photos = activity.photos ?? compatible;
    const requested =
        activity.coverPhoto !== undefined
            ? activity.coverPhoto
            : activity.coverImageId !== undefined && activity.coverImageId !== null
              ? { source: "upload" as const, imageId: activity.coverImageId }
              : activity.coverImageId === null
                ? previous?.coverPhoto?.source === "unsplash"
                    ? previous.coverPhoto
                    : selectedExternal
                      ? { source: "unsplash" as const, providerImageId: selectedExternal.providerImageId }
                      : null
                : previous?.coverPhoto;
    const cover =
        requested === null
            ? null
            : requested && photos.some((photo) => photoKey(photo) === photoKey(requested))
              ? requested
              : (photos[0] ?? null);
    const first = photos.find((photo) => photo.source === "unsplash");
    return {
        ...activity,
        photos,
        coverPhoto: cover
            ? cover.source === "upload"
                ? { source: "upload", imageId: cover.imageId }
                : { source: "unsplash", providerImageId: cover.providerImageId }
            : null,
        uploadedImageIds: photos.flatMap((photo) => (photo.source === "upload" ? [photo.imageId] : [])),
        coverImageId: cover?.source === "upload" ? cover.imageId : null,
        externalImage: first ? { ...first, provider: "unsplash" } : null
    };
}
