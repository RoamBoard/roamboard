import type { BoardDayDraft, BoardImageDraft, BoardPinDraft } from "@/types/board-creator";
import type { UploadedBoardImage } from "@/components/features/boards/BoardImageIntake";

const DAY = 86400000;
export type SmartCreatePlan = {
    days: BoardDayDraft[];
    images: BoardImageDraft[];
    requiresConfirmation: boolean;
    canApply: boolean;
    ignoredCount: number;
    createdCount: number;
    shiftDays: number;
    removedTitles: string[];
    warnings: string[];
    startDate: string | null;
};
function dateNumber(value: string | null): number | null {
    const date = value?.slice(0, 10);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const number = Date.parse(date + "T00:00:00Z");
    return Number.isFinite(number) && new Date(number).toISOString().slice(0, 10) === date ? number : null;
}
function timeNumber(value: string): number | null {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
    return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
function distance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
    const radians = Math.PI / 180;
    const h =
        Math.sin(((a.latitude - b.latitude) * radians) / 2) ** 2 +
        Math.cos(a.latitude * radians) *
            Math.cos(b.latitude * radians) *
            Math.sin(((a.longitude - b.longitude) * radians) / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function buildSmartCreatePlan(
    current: BoardDayDraft[],
    images: BoardImageDraft[],
    uploads: UploadedBoardImage[],
    startDate?: string | null
): SmartCreatePlan {
    const existing = images.map((image) => ({ ...image }));
    const incoming = uploads.filter(
        (upload) => !existing.some((image) => image.uploadedImageId === upload.image.uploadedImageId)
    );
    const all = [
        ...existing,
        ...incoming.map((upload, index) => ({ ...upload.image, pinId: null, order: existing.length + index }))
    ];
    // Infer the existing photo timeline from persisted photo dates and assigned day numbers.
    // Calendar dates stay off Board days, including after saving and reopening.
    const anchors = current.flatMap((day) =>
        day.pins.flatMap((pin) =>
            pin.source === "photo"
                ? existing
                      .filter((image) => image.pinId === pin.id)
                      .flatMap((image) => {
                          const date = dateNumber(image.capturedAt);
                          return date === null ? [] : [date - (day.dayNumber - 1) * DAY];
                      })
                : []
        )
    );
    const oldAnchor = startDate === undefined ? (anchors.length ? Math.min(...anchors) : null) : dateNumber(startDate);
    const dates = incoming.flatMap((upload) => {
        const date = dateNumber(upload.suggestedDate ?? upload.image.capturedAt);
        return date === null ? [] : [date];
    });
    const anchor = Math.min(...dates, ...(oldAnchor === null ? [] : [oldAnchor]));
    const shiftDays =
        oldAnchor === null || !Number.isFinite(anchor) ? 0 : Math.max(0, Math.round((oldAnchor - anchor) / DAY));
    const removedTitles: string[] = [];
    const overflow = current.filter((day) => day.dayNumber + shiftDays > 31);
    const canApply = !overflow.some((day) => day.pins.some((pin) => pin.source !== "photo"));
    const days = current
        .filter((day) => day.dayNumber + shiftDays <= 31)
        .map((day) => ({ ...day, dayNumber: day.dayNumber + shiftDays, pins: day.pins.map((pin) => ({ ...pin })) }));
    const removedIds = new Set(
        overflow.flatMap((day) =>
            day.pins.map((pin) => {
                removedTitles.push(pin.title);
                return pin.id;
            })
        )
    );
    for (const image of all)
        if (image.pinId && removedIds.has(image.pinId)) {
            image.pinId = null;
            image.activityOrder = undefined;
        }
    const ensureDay = (number: number) => {
        for (const dayNumber of Array.from({ length: number }, (_, index) => index + 1))
            if (!days.some((day) => day.dayNumber === dayNumber))
                days.push({ id: crypto.randomUUID(), dayNumber, date: null, pins: [] });
        return days.find((day) => day.dayNumber === number)!;
    };
    const newPinIds = new Set<string>();
    const counts = { ignored: 0, missingLocation: 0, missingDate: 0 };
    for (const upload of incoming) {
        const image = all.find((item) => item.id === upload.image.id)!;
        const captured = dateNumber(upload.suggestedDate ?? image.capturedAt);
        const dayNumber = captured === null || !Number.isFinite(anchor) ? 1 : Math.round((captured - anchor) / DAY) + 1;
        if (dayNumber < 1 || dayNumber > 31) {
            counts.ignored++;
            continue;
        }
        if (!upload.suggestedPin?.location) {
            counts.missingLocation++;
            continue;
        }
        if (captured === null) counts.missingDate++;
        const day = ensureDay(dayNumber);
        const suggested = upload.suggestedPin;
        const match =
            captured === null
                ? undefined
                : day.pins.find((pin) => {
                      if (pin.source !== "photo" || !pin.location) return false;
                      const firstPhoto = all
                          .filter((item) => item.pinId === pin.id)
                          .sort((a, b) => a.order - b.order)[0];
                      const firstDate = dateNumber(firstPhoto?.capturedAt ?? null);
                      const firstTime = firstPhoto?.capturedAt?.slice(11, 16) ?? "";
                      const timeA = timeNumber(firstTime),
                          timeB = timeNumber(suggested.time);
                      const point =
                          firstPhoto?.latitude !== null &&
                          firstPhoto?.latitude !== undefined &&
                          firstPhoto.longitude !== null
                              ? { latitude: firstPhoto.latitude, longitude: firstPhoto.longitude }
                              : pin.location;
                      return (
                          firstDate === captured &&
                          timeA !== null &&
                          timeB !== null &&
                          Math.abs(timeA - timeB) <= 120 &&
                          distance(
                              point,
                              image.latitude !== null && image.longitude !== null
                                  ? { latitude: image.latitude, longitude: image.longitude }
                                  : suggested.location!
                          ) <= 100
                      );
                  });
        if (match) {
            image.pinId = match.id;
            image.activityOrder =
                all
                    .filter((item) => item !== image && item.pinId === match.id)
                    .reduce((max, item) => Math.max(max, item.activityOrder ?? item.order), -1) + 1;
            // Only new suggestions get their start time refined. Never overwrite an edited existing activity.
            if (newPinIds.has(match.id) && suggested.time && (!match.time || suggested.time < match.time))
                match.time = suggested.time;
        } else {
            const pin: BoardPinDraft = {
                ...suggested,
                id: crypto.randomUUID(),
                coverImageId: image.uploadedImageId ?? null,
                order: day.pins.length
            };
            day.pins.push(pin);
            newPinIds.add(pin.id);
            image.pinId = pin.id;
            image.activityOrder = 0;
        }
    }
    if (days.length) ensureDay(Math.max(...days.map((day) => day.dayNumber)));
    const orderedDays = days
        .sort((a, b) => a.dayNumber - b.dayNumber)
        .map((day) => {
            const old = day.pins.filter((pin) => !newPinIds.has(pin.id));
            const added = day.pins
                .filter((pin) => newPinIds.has(pin.id))
                .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
            return { ...day, pins: [...old, ...added].map((pin, order) => ({ ...pin, order })) };
        });
    const warnings = [...new Set(incoming.flatMap((upload) => (upload.warning ? [upload.warning] : [])))];
    if (counts.ignored) warnings.push(counts.ignored + " photos fall outside the first 31 days and remain unassigned.");
    if (counts.missingLocation)
        warnings.push(counts.missingLocation + " photos have no GPS and remain available for manual assignment.");
    if (counts.missingDate)
        warnings.push(counts.missingDate + " photos have no capture date; their suggestions were added to Day 1.");
    if (!canApply)
        warnings.push(
            "Moving the timeline would put manually added activities beyond Day 31. Keep the current plan and assign these photos manually."
        );
    return {
        startDate: Number.isFinite(anchor) ? new Date(anchor).toISOString().slice(0, 10) : null,
        days: orderedDays,
        images: all,
        requiresConfirmation: shiftDays > 0,
        canApply,
        ignoredCount: counts.ignored,
        createdCount: newPinIds.size,
        shiftDays,
        removedTitles,
        warnings
    };
}
