import type { BoardActivity, BoardImage } from "@/types/board";
import type { PublishedBoardDay } from "@/types/published-board";

export type ScenePhoto = { id: string; image: BoardImage; activityId?: string; illustration?: boolean };
export type DayScene = {
    id: string;
    day: PublishedBoardDay;
    part: number;
    parts: number;
    photos: ScenePhoto[];
};

// Keep every placement and its saved order. A photo-rich day has two scenes, never a hidden remainder.
export function createDayScenes(day: PublishedBoardDay, photos: ScenePhoto[]): DayScene[] {
    const parts = photos.length > 6 ? 2 : 1;
    const split = Math.ceil(photos.length / parts);
    return Array.from({ length: parts }, (_, index) => ({
        id: index === 0 ? `day-${day.number}` : `day-${day.number}-part-2`,
        day,
        part: index + 1,
        parts,
        photos: photos.slice(index * split, (index + 1) * split)
    }));
}

export function sceneActivities(day: PublishedBoardDay): BoardActivity[] {
    return day.items.filter((item): item is BoardActivity => item.type === "activity");
}

export function storySeed(value: string): number {
    return Array.from(value).reduce((seed, character) => (seed * 31 + character.codePointAt(0)!) >>> 0, 7);
}

const compositions = [
    [[2, 12, 2, 12]],
    [
        [1, 8, 1, 10],
        [8, 13, 5, 13]
    ],
    [
        [1, 8, 2, 12],
        [9, 13, 1, 6],
        [8, 13, 8, 13]
    ],
    [
        [1, 7, 1, 7],
        [8, 13, 2, 8],
        [2, 7, 8, 13],
        [8, 13, 9, 13]
    ],
    [
        [1, 6, 1, 7],
        [7, 13, 1, 6],
        [1, 5, 8, 13],
        [6, 10, 7, 13],
        [10, 13, 8, 13]
    ],
    [
        [1, 5, 1, 7],
        [6, 10, 2, 7],
        [10, 13, 1, 6],
        [1, 5, 8, 13],
        [5, 10, 8, 13],
        [10, 13, 7, 13]
    ]
] as const;

export function photoComposition(count: number, index: number, seed: number) {
    const shape = [1, 16 / 9, 4 / 3, 3 / 4][(index + seed) % 4];
    const position = ["start", "center", "end"][(index + seed) % 3];
    const placement = compositions[count - 1]?.[index];
    if (!placement) return { aspectRatio: shape, alignSelf: position, justifySelf: position };
    const [start, end, top, bottom] = placement;
    return {
        aspectRatio: shape,
        gridColumn: seed % 2 ? `${14 - end} / ${14 - start}` : `${start} / ${end}`,
        gridRow: seed % 3 === 1 ? `${14 - bottom} / ${14 - top}` : `${top} / ${bottom}`,
        alignSelf: position,
        justifySelf: position
    };
}
