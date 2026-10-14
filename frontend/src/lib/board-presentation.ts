import type { Board } from "@/types/board";
import type { PublishedBoardDay } from "@/types/published-board";

// Group a flat item list into the numbered days shown on the board page.
export function getBoardDays(board: Board): PublishedBoardDay[] {
    // Sorted dates give dated activities a day number when none was set.
    const dates = Array.from(
        new Set(
            board.items.flatMap((item) =>
                item.type === "activity" && item.date ? [item.date] : []
            )
        )
    ).sort();
    const groups = new Map<number, Board["items"]>();

    for (const item of board.items) {
        const dateDay =
            item.type === "activity" && item.date
                ? dates.indexOf(item.date) + 1
                : 1;
        // An explicit day number takes priority over the date-based number.
        const number = item.dayNumber ?? dateDay;
        const items = groups.get(number) ?? [];
        items.push(item);
        groups.set(number, items);
    }

    // Include empty days too if the board has a longer planned duration.
    for (const number of Array.from(
        { length: board.durationDays ?? 0 },
        (_, index) => index + 1
    )) {
        if (!groups.has(number)) groups.set(number, []);
    }

    return Array.from(groups, ([number, items]) => {
        const activities = items.filter((item) => item.type === "activity");
        const first = activities[0]?.title;
        const last = activities.at(-1)?.title;
        // Use a custom heading, or build one from the first and last activity.
        const title =
            board.dayTitles?.[number] ??
            (first && last && first !== last
                ? `${first} → ${last}`
                : (first ?? ""));
        return { number, title, items };
    }).sort((first, second) => first.number - second.number);
}

// Count a location once even if several activities use it.
export function getBoardPlaceNames(board: Board): string[] {
    const places = new Map<string, string>();
    for (const item of board.items) {
        if (
            (item.type === "activity" || item.type === "location") &&
            item.location
        ) {
            places.set(item.location.id, item.location.name);
        }
    }
    return Array.from(places.values());
}
