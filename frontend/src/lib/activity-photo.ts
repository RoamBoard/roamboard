import type { BoardImageDraft, BoardPinDraft, PinLocation } from "@/types/board-creator";
import type { SmartPhotoSuggestion } from "./board-creator-api";
export function photoActivityLocation(
    image: Pick<BoardImageDraft, "latitude" | "longitude">,
    suggestion?: SmartPhotoSuggestion
): PinLocation | null {
    if (image.latitude === null || image.longitude === null) return null;
    const place = suggestion?.location;
    return {
        name: place?.detail || place?.label || place?.address || "Photo location",
        address: place?.address ?? "",
        latitude: image.latitude,
        longitude: image.longitude,
        country: place?.country ?? null,
        countryCode: place?.countryCode ?? null,
        city: place?.city ?? null,
        mapboxId: place?.id ?? null
    };
}
export function fillActivityFromPhoto(
    activity: BoardPinDraft,
    image: Pick<BoardImageDraft, "latitude" | "longitude" | "capturedAt">,
    suggestion?: SmartPhotoSuggestion
): BoardPinDraft {
    const location = activity.location ?? photoActivityLocation(image, suggestion);
    const time = image.capturedAt?.match(/T(\d{2}:\d{2})/)?.[1] ?? "";
    return {
        ...activity,
        location,
        title: activity.location ? activity.title : (location?.name ?? activity.title),
        time: activity.time || time,
        category:
            activity.category === "activity" || activity.category === "other"
                ? (suggestion?.category ?? activity.category)
                : activity.category,
        source: !activity.location && location ? "photo" : activity.source
    };
}
