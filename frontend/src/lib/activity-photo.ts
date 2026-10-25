import type { BoardImageDraft, BoardPinDraft, PinLocation } from "@/types/board-creator";
import type { SmartPhotoSuggestion } from "./board-creator-api";

export function activityBatchDefaults(images: BoardImageDraft[]) {
    const dated = (image: BoardImageDraft) => {
        const value = image.capturedAt;
        if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
        const wallTime = value.slice(0, 19);
        const parsed = Date.parse(wallTime + "Z");
        return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 19) === wallTime ? wallTime : null;
    };
    const ordered = images
        .filter((image) => image.source === "upload")
        .map((image, index) => ({ image, index, date: dated(image) }))
        .sort(
            (a, b) =>
                (a.date === b.date ? 0 : a.date === null ? 1 : b.date === null ? -1 : a.date.localeCompare(b.date)) ||
                a.index - b.index
        );
    const first = ordered[0];
    return {
        coverImageId: first?.image.uploadedImageId ?? null,
        locationImage:
            ordered.find(
                ({ image }) =>
                    image.latitude !== null &&
                    image.longitude !== null &&
                    Number.isFinite(image.latitude) &&
                    Number.isFinite(image.longitude) &&
                    Math.abs(image.latitude) <= 90 &&
                    Math.abs(image.longitude) <= 180
            )?.image ?? null,
        time: first?.date?.slice(11, 16) ?? ""
    };
}
export function photoActivityLocation(
    image: Pick<BoardImageDraft, "latitude" | "longitude">,
    suggestion?: SmartPhotoSuggestion
): PinLocation | null {
    if (image.latitude === null || image.longitude === null) return null;
    const place = suggestion?.location;
    return {
        name: place?.detail || place?.label || "Photo location",
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
        title: activity.title || location?.name || "",
        time: activity.time || time,
        category:
            activity.category === "activity" || activity.category === "other"
                ? (suggestion?.category ?? activity.category)
                : activity.category,
        source: !activity.location && location ? "photo" : activity.source
    };
}
