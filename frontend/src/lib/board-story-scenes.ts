import type { BoardActivity, BoardImage } from "@/types/board";
import type { PublishedBoardDay } from "@/types/published-board";

export type ScenePhoto = { id: string; image: BoardImage; activityId?: string; illustration?: boolean };
export type DayScene = {
    id: string;
    day: PublishedBoardDay;
    part: number;
    parts: number;
    photos: ScenePhoto[];
    textActivities: BoardActivity[];
};

// Balance scenes around the six-photo limit, retaining every placement in its saved order.
export function createDayScenes(day: PublishedBoardDay, photos: ScenePhoto[]): DayScene[] {
    const parts = Math.max(1, Math.ceil(photos.length / 6));
    const split = Math.floor(photos.length / parts);
    const remainder = photos.length % parts;
    const scenes: DayScene[] = Array.from({ length: parts }, (_, index) => ({
        id: index === 0 ? `day-${day.number}` : `day-${day.number}-part-${index + 1}`,
        day,
        part: index + 1,
        parts,
        photos: photos.slice(
            index * split + Math.min(index, remainder),
            (index + 1) * split + Math.min(index + 1, remainder)
        ),
        textActivities: []
    }));
    const activities = sceneActivities(day);
    const photoSceneByActivity = new Map<string, number[]>();
    scenes.forEach((scene, sceneIndex) => {
        scene.photos.forEach((photo) => {
            if (!photo.activityId) return;
            const sceneIndexes = photoSceneByActivity.get(photo.activityId) ?? [];
            if (!sceneIndexes.includes(sceneIndex)) sceneIndexes.push(sceneIndex);
            photoSceneByActivity.set(photo.activityId, sceneIndexes);
        });
    });
    const textOnly = activities.filter((activity) => !activity.images.length);
    textOnly.forEach((activity) => {
        const activityIndex = activities.indexOf(activity);
        const previousPhotoActivity = activities
            .slice(0, activityIndex)
            .reverse()
            .find((candidate) => photoSceneByActivity.has(candidate.id));
        const nextPhotoActivity = activities
            .slice(activityIndex + 1)
            .find((candidate) => photoSceneByActivity.has(candidate.id));
        const previousScene = previousPhotoActivity
            ? photoSceneByActivity.get(previousPhotoActivity.id)!.at(-1)
            : undefined;
        const nextScene = nextPhotoActivity ? photoSceneByActivity.get(nextPhotoActivity.id)![0] : undefined;
        const sceneIndex = previousScene ?? nextScene ?? 0;
        scenes[sceneIndex]!.textActivities.push(activity);
    });
    return scenes;
}

export function sceneActivities(day: PublishedBoardDay): BoardActivity[] {
    const activities = day.items.filter((item): item is BoardActivity => item.type === "activity");
    const timed = activities
        .filter((activity) => /^\d{2}:\d{2}$/.test(activity.time ?? ""))
        .sort((a, b) => a.time!.localeCompare(b.time!));
    const cursor = { index: 0 };
    // Untimed stops keep their itinerary slots; timed stops progress from morning to evening around them.
    return activities.map((activity) => (/^\d{2}:\d{2}$/.test(activity.time ?? "") ? timed[cursor.index++] : activity));
}

export function storySeed(value: string): number {
    return Array.from(value).reduce((seed, character) => (seed * 31 + character.codePointAt(0)!) >>> 0, 7);
}

const compositions = [
    [[4, 13, 1, 7]],
    [
        [4, 10, 1, 4],
        [6, 13, 4, 7]
    ],
    [
        [4, 9, 1, 4],
        [9, 13, 2, 5],
        [4, 9, 4, 7]
    ],
    [
        [4, 9, 1, 4],
        [9, 13, 1, 4],
        [4, 8, 4, 7],
        [8, 13, 4, 7]
    ],
    [
        [4, 8, 1, 4],
        [8, 13, 1, 4],
        [4, 7, 4, 7],
        [7, 10, 4, 7],
        [10, 13, 4, 7]
    ],
    [
        [4, 7, 1, 4],
        [7, 10, 1, 4],
        [10, 13, 1, 4],
        [4, 8, 4, 7],
        [8, 11, 4, 7],
        [11, 13, 4, 7]
    ]
] as const;

export function photoComposition(count: number, index: number, seed: number) {
    const shape = [1, 16 / 9, 4 / 3, 3 / 4][(index + seed) % 4];
    const placement = compositions[count - 1]?.[index];
    if (!placement) {
        const perRow = count > 18 ? 4 : 3;
        const offset = Math.floor(index / perRow) * perRow;
        const rowCount = Math.min(perRow, count - offset);
        const widths = rowCount === 4 ? [3, 4, 2, 3] : rowCount === 3 ? [4, 5, 3] : rowCount === 2 ? [7, 5] : [12];
        const shift = seed % widths.length;
        const columns = widths.map((_, position) => widths[(position + shift) % widths.length]);
        const start = 1 + columns.slice(0, index % perRow).reduce((sum, width) => sum + width, 0);
        return {
            aspectRatio: shape,
            gridColumn: `${start} / span ${columns[index % perRow]}`,
            gridRow: `${Math.floor(index / perRow) + 1}`
        };
    }
    const [start, end, top, bottom] = placement;
    // Vary shared boundaries, never flip the reading order or the day/map corner spaces.
    const boundary = (column: number) => (column === 9 && seed % 2 ? 8 : column);
    return {
        aspectRatio: shape,
        gridColumn: `${boundary(start)} / ${boundary(end)}`,
        gridRow: `${top} / ${bottom}`
    };
}
