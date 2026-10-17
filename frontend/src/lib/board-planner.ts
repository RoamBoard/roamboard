import type { BoardDayDraft } from "@/types/board-creator";

// Pointer drops retain time-based placement; explicit move controls preserve the requested position.
export function movePlannerPin(
    days: BoardDayDraft[],
    pinId: string,
    targetDayId: string,
    time: string,
    targetIndex?: number
): BoardDayDraft[] {
    const pin = days.flatMap((day) => day.pins).find((item) => item.id === pinId);
    if (!pin || !days.some((day) => day.id === targetDayId)) return days;
    return days.map((day) => {
        if (day.id !== targetDayId && !day.pins.some((item) => item.id === pinId)) return day;
        const remaining = day.pins.filter((item) => item.id !== pinId);
        const next =
            day.id !== targetDayId
                ? remaining
                : targetIndex === undefined
                  ? [...remaining, { ...pin, time }].sort((a, b) => a.time.localeCompare(b.time) || a.order - b.order)
                  : remaining.toSpliced(Math.max(0, Math.min(remaining.length, targetIndex)), 0, { ...pin, time });
        return { ...day, pins: next.map((item, order) => ({ ...item, order })) };
    });
}

export function reorderPlannerPin(days: BoardDayDraft[], pinId: string, direction: -1 | 1): BoardDayDraft[] {
    const day = days.find((item) => item.pins.some((pin) => pin.id === pinId));
    if (!day) return days;
    const index = day.pins.findIndex((pin) => pin.id === pinId);
    const destination = index + direction;
    if (destination < 0 || destination >= day.pins.length) return days;
    return movePlannerPin(days, pinId, day.id, day.pins[index].time, destination);
}
