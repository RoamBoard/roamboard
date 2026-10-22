"use client";

import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import StoryPhoto from "./StoryPhoto";
import { photoComposition, sceneActivities, storySeed, type DayScene } from "@/lib/board-story-scenes";
import type { BoardActivity } from "@/types/board";

function ActivityCaption({
    activity,
    compact,
    onOpen,
    onLocation
}: {
    activity: BoardActivity;
    compact: boolean;
    onOpen: (activity: BoardActivity) => void;
    onLocation?: (activity: BoardActivity) => void;
}) {
    return (
        <div className="min-w-0 shrink-0">
            <button
                type="button"
                onClick={() => onOpen(activity)}
                className="font-display block min-h-11 max-w-full text-left text-xl leading-tight font-semibold hover:underline"
            >
                {activity.time ? (
                    <span className="text-muted-foreground mb-1 block font-sans text-xs font-normal">
                        {activity.time}
                    </span>
                ) : null}
                <span className="line-clamp-2">{activity.title}</span>
            </button>
            {activity.description ? (
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed whitespace-pre-line">
                    {Array.from(activity.description).slice(0, 150).join("")}
                    {Array.from(activity.description).length > 150 ? "…" : ""}
                </p>
            ) : null}
            {!compact && activity.location && onLocation ? (
                <button
                    type="button"
                    onClick={() => onLocation(activity)}
                    className="text-muted-foreground mt-1 flex min-h-9 max-w-full items-center gap-1 text-left text-xs underline underline-offset-2"
                >
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">{activity.location.name}</span>
                </button>
            ) : null}
        </div>
    );
}

export default function BoardDayScene({
    scene,
    boardId,
    desktop,
    onOpenPhoto,
    onOpenActivity,
    onHighlight,
    onLocation,
    journeyMap
}: {
    scene: DayScene;
    boardId: string;
    desktop: boolean;
    onOpenPhoto: (id: string) => void;
    onOpenActivity: (activity: BoardActivity) => void;
    onHighlight: (id?: string) => void;
    onLocation?: (activity: BoardActivity) => void;
    journeyMap?: ReactNode;
}) {
    const activities = sceneActivities(scene.day);
    const photoActivities = new Set(scene.photos.map((photo) => photo.activityId));
    const unpictured = activities.filter((activity) => !activity.images.length);
    const textActivities = unpictured.filter(
        (_, index) => Math.floor((index * scene.parts) / Math.max(1, unpictured.length)) === scene.part - 1
    );
    const timelineActivities = activities.filter(
        (activity) => photoActivities.has(activity.id) || textActivities.includes(activity)
    );
    const tiles = [
        ...scene.photos.map((photo, index) => ({
            key: photo.id,
            photo,
            activity:
                !photo.illustration &&
                photo.activityId &&
                scene.photos.findIndex((other) => !other.illustration && other.activityId === photo.activityId) ===
                    index
                    ? activities.find((activity) => activity.id === photo.activityId)
                    : undefined,
            activityId: photo.activityId
        })),
        ...textActivities.map((activity) => ({
            key: `text-${activity.id}`,
            photo: undefined,
            activity,
            activityId: activity.id
        }))
    ].sort((a, b) => {
        const rank = (id?: string) => {
            const index = activities.findIndex((activity) => activity.id === id);
            return index < 0 ? activities.length : index;
        };
        return rank(a.activityId) - rank(b.activityId);
    });
    const dense = tiles.length > 6;
    const seed = storySeed(`${boardId}:${scene.id}`);
    const tile = (item: (typeof tiles)[number], index: number) => {
        const composition = photoComposition(tiles.length, index, seed);
        const compact = dense || tiles.length >= 5;
        const sideCaption = desktop && item.activity && !compact;
        const captionFirst = index % 2 === 1;
        return (
            <div
                key={item.key}
                data-story-photo={item.photo?.id}
                data-story-activity={item.activityId}
                onMouseEnter={() => onHighlight(item.activityId)}
                onMouseLeave={() => onHighlight(undefined)}
                onFocus={() => onHighlight(item.activityId)}
                className="@container min-h-0 min-w-0"
                style={
                    desktop
                        ? { gridColumn: composition.gridColumn, gridRow: composition.gridRow }
                        : {
                              gridColumn: index % 5 === 0 ? "span 2" : undefined,
                              marginTop: index % 4 === 2 ? "1.5rem" : undefined
                          }
                }
            >
                <div
                    className={
                        desktop
                            ? `grid h-full min-h-0 gap-3 ${item.activity && item.photo ? "grid-rows-[minmax(0,1fr)_auto]" : "grid-rows-1"} ${sideCaption ? (captionFirst ? "@min-[30rem]:grid-cols-[minmax(9rem,0.55fr)_minmax(0,1fr)] @min-[30rem]:grid-rows-1 @min-[30rem]:items-center" : "@min-[30rem]:grid-cols-[minmax(0,1fr)_minmax(9rem,0.55fr)] @min-[30rem]:grid-rows-1 @min-[30rem]:items-center") : ""}`
                            : "flex min-w-0 flex-col gap-3"
                    }
                >
                    {item.photo ? (
                        <div
                            className={
                                desktop
                                    ? "[container-type:size] flex h-full min-h-11 min-w-0 items-start justify-center"
                                    : "min-w-0"
                            }
                        >
                            <StoryPhoto
                                image={item.photo.image}
                                aspectRatio={composition.aspectRatio}
                                frame={desktop}
                                preservePortrait
                                portraitShape={(seed + index) % 2 ? "square" : "tall"}
                                onOpen={() => onOpenPhoto(item.photo!.id)}
                            />
                            {item.photo.illustration ? <span className="sr-only">Destination illustration</span> : null}
                        </div>
                    ) : null}
                    {item.activity ? (
                        <div
                            data-story-caption
                            className={`min-w-0 text-center [&_button]:mx-auto [&_button]:text-center ${sideCaption ? "@min-[30rem]:text-left @min-[30rem]:[&_button]:mx-0 @min-[30rem]:[&_button]:text-left" : ""} ${sideCaption && captionFirst ? "@min-[30rem]:order-first" : ""}`}
                        >
                            <ActivityCaption
                                activity={item.activity}
                                compact={compact}
                                onOpen={onOpenActivity}
                                onLocation={onLocation}
                            />
                        </div>
                    ) : null}
                </div>
            </div>
        );
    };
    return (
        <section
            id={scene.id}
            data-story-scene
            data-story-chapter
            aria-labelledby={`${scene.id}-heading`}
            tabIndex={-1}
            className={
                desktop
                    ? "relative h-full w-[var(--story-width)] shrink-0 snap-start snap-always [scrollbar-gutter:stable] overflow-y-auto py-6 pr-24 pl-20 outline-none"
                    : "border-line scroll-mt-16 border-b px-5 py-8 outline-none sm:px-8"
            }
        >
            <div
                className={desktop ? "grid h-full min-h-[48rem] grid-cols-12 gap-5" : "grid grid-cols-2 gap-5"}
                style={desktop ? { gridTemplateRows: "repeat(6, minmax(0, 1fr))" } : undefined}
            >
                <header
                    className={
                        desktop ? "col-[1/4] row-[1/4] flex min-h-0 min-w-0 flex-col pt-6" : "col-span-2 mt-3 mb-2"
                    }
                >
                    <h2
                        id={`${scene.id}-heading`}
                        className="font-display shrink-0 text-6xl leading-none font-bold xl:text-7xl"
                    >
                        Day {String(scene.day.number).padStart(2, "0")}
                    </h2>
                    <p className="text-muted-foreground mt-3 shrink-0 text-base">
                        {activities.length} activities
                        {scene.parts > 1 ? ` · Scene ${scene.part} of ${scene.parts}` : ""}
                    </p>
                    {scene.day.date ? (
                        <time dateTime={scene.day.date} className="text-muted-foreground mt-2 block shrink-0 text-xs">
                            {scene.day.date}
                        </time>
                    ) : null}
                    {scene.day.title ? (
                        <p
                            className="text-muted-foreground mt-3 line-clamp-1 shrink-0 text-sm leading-relaxed"
                            title={scene.day.title}
                        >
                            {scene.day.title}
                        </p>
                    ) : null}
                    {timelineActivities.length ? (
                        <div className="mt-5 flex min-h-0 flex-col">
                            <ol
                                aria-label={`Day ${scene.day.number} activity timeline`}
                                className="grid grid-cols-2 items-start gap-x-4 gap-y-2"
                            >
                                {timelineActivities.map((activity) => (
                                    <li
                                        key={activity.id}
                                        className="border-line relative border-l pl-4"
                                        onMouseEnter={() => onHighlight(activity.id)}
                                        onMouseLeave={() => onHighlight(undefined)}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="bg-foreground absolute top-2 -left-[3px] size-[5px] rounded-full"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => onOpenActivity(activity)}
                                            onFocus={() => onHighlight(activity.id)}
                                            className="block min-h-11 w-full text-left hover:underline"
                                        >
                                            {activity.time ? (
                                                <time
                                                    dateTime={activity.time}
                                                    className="text-muted-foreground block text-xs tabular-nums"
                                                >
                                                    {activity.time}
                                                </time>
                                            ) : (
                                                <span className="text-muted-foreground block text-xs">
                                                    Time not set
                                                </span>
                                            )}
                                            <span className="mt-1 block text-sm leading-relaxed">{activity.title}</span>
                                        </button>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    ) : null}
                </header>
                {journeyMap && (desktop || scene.part === 1) ? (
                    <div data-story-map className={desktop ? "col-[1/4] row-[4/7] self-end" : "col-span-2 mb-3"}>
                        {journeyMap}
                    </div>
                ) : null}
                {tiles.length ? (
                    dense ? (
                        <div
                            data-story-gallery
                            className={
                                desktop
                                    ? "col-[4/13] row-[1/7] grid min-h-0 grid-cols-12 gap-5 overflow-y-auto pb-1"
                                    : "col-span-2 grid grid-cols-2 gap-5"
                            }
                            aria-label={`Day ${scene.day.number} photographs and activities`}
                            style={
                                desktop
                                    ? { gridAutoRows: tiles.length > 18 ? "minmax(10rem, 1fr)" : "minmax(14rem, 1fr)" }
                                    : undefined
                            }
                        >
                            {tiles.map(tile)}
                        </div>
                    ) : (
                        tiles.map(tile)
                    )
                ) : (
                    <div className={desktop ? "col-[4/13] row-[1/7] flex flex-col justify-center" : "col-span-2 py-10"}>
                        <p className="font-display max-w-lg text-4xl leading-tight sm:text-6xl">
                            A little room to wander.
                        </p>
                        <p className="text-muted-foreground mt-5 max-w-md text-sm leading-relaxed">
                            No activities are recorded for this day. Continue to the next chapter or explore the journey
                            map.
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}
