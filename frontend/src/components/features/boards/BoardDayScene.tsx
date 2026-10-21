"use client";

import type { ReactNode } from "react";
import StoryPhoto from "./StoryPhoto";
import { photoComposition, sceneActivities, storySeed, type DayScene } from "@/lib/board-story-scenes";
import type { BoardActivity } from "@/types/board";

export default function BoardDayScene({
    scene,
    boardId,
    desktop,
    onOpenPhoto,
    onOpenActivity,
    onHighlight,
    mobileMap
}: {
    scene: DayScene;
    boardId: string;
    desktop: boolean;
    onOpenPhoto: (id: string) => void;
    onOpenActivity: (activity: BoardActivity) => void;
    onHighlight: (id?: string) => void;
    mobileMap?: ReactNode;
}) {
    const activities = sceneActivities(scene.day);
    const count = scene.photos.length;
    const columns = count <= 6 ? 12 : Math.min(6, Math.ceil(Math.sqrt(count * 1.4)));
    const rows = count <= 6 ? 12 : Math.ceil(count / columns);
    const seed = storySeed(`${boardId}:${scene.id}`);
    return (
        <section
            id={scene.id}
            data-story-scene
            data-story-chapter
            aria-labelledby={`${scene.id}-heading`}
            tabIndex={-1}
            className={
                desktop
                    ? "relative h-full w-[var(--story-width)] shrink-0 snap-start snap-always overflow-y-auto overscroll-y-contain px-8 py-6 outline-none"
                    : "border-line scroll-mt-16 border-b px-5 py-8 outline-none sm:px-8"
            }
        >
            <header className={desktop ? "sr-only" : "mb-6"}>
                <p className="text-muted-foreground text-[10px] tracking-[0.2em] uppercase">
                    {scene.part === 1 ? "The journey" : "More from this day"}
                </p>
                <h2 id={`${scene.id}-heading`} className="font-display mt-2 text-6xl font-bold">
                    Day {scene.day.number}
                </h2>
                {scene.day.date ? (
                    <time dateTime={scene.day.date} className="text-muted-foreground mt-2 block text-xs">
                        {scene.day.date}
                    </time>
                ) : null}
                {scene.day.title ? <p className="text-muted-foreground mt-3 text-sm">{scene.day.title}</p> : null}
            </header>
            {!desktop && scene.part === 1 ? (
                <>
                    {mobileMap}
                    <div className="my-6 grid gap-5">
                        {activities.map((activity) => (
                            <div key={activity.id}>
                                <button
                                    type="button"
                                    onClick={() => onOpenActivity(activity)}
                                    className="font-display min-h-11 text-left text-xl font-semibold"
                                >
                                    {activity.time ? (
                                        <span className="text-muted-foreground mr-3 font-sans text-xs">
                                            {activity.time}
                                        </span>
                                    ) : null}
                                    {activity.title}
                                </button>
                                {activity.description ? (
                                    <p className="text-muted-foreground text-xs leading-relaxed">
                                        {Array.from(activity.description).slice(0, 120).join("")}
                                        {Array.from(activity.description).length > 120 ? "…" : ""}
                                    </p>
                                ) : null}
                            </div>
                        ))}
                    </div>
                </>
            ) : null}
            {count ? (
                <div
                    aria-label={`Day ${scene.day.number} photographs${scene.parts > 1 ? `, scene ${scene.part} of ${scene.parts}` : ""}`}
                    className={desktop ? "grid min-h-full gap-4" : "grid gap-4"}
                    style={{
                        gridTemplateColumns: `repeat(${desktop ? columns : 2}, minmax(0, 1fr))`,
                        gridTemplateRows: desktop
                            ? `repeat(${rows}, minmax(${count > 18 ? "6rem" : "0px"}, 1fr))`
                            : undefined,
                        height: desktop ? "100%" : undefined
                    }}
                >
                    {scene.photos.map((photo, index) => {
                        const composition = photoComposition(count, index, seed);
                        return (
                            <div
                                key={photo.id}
                                data-story-photo={photo.id}
                                data-story-activity={photo.activityId}
                                onMouseEnter={() => onHighlight(photo.activityId)}
                                onMouseLeave={() => onHighlight(undefined)}
                                onFocus={() => onHighlight(photo.activityId)}
                                className={
                                    desktop
                                        ? "[container-type:size] flex min-h-0 min-w-0 items-center justify-center"
                                        : "flex min-w-0 items-start"
                                }
                                style={
                                    desktop
                                        ? {
                                              gridColumn: composition.gridColumn,
                                              gridRow: composition.gridRow,
                                              alignSelf: "stretch",
                                              justifySelf: "stretch"
                                          }
                                        : {
                                              gridColumn: index % 5 === 0 ? "span 2" : undefined,
                                              marginTop: index % 4 === 2 ? "2rem" : undefined
                                          }
                                }
                            >
                                <div
                                    className={desktop ? "contents" : "w-full"}
                                    style={desktop ? undefined : { paddingInline: index % 5 === 0 ? "8%" : undefined }}
                                >
                                    <StoryPhoto
                                        image={photo.image}
                                        aspectRatio={composition.aspectRatio}
                                        onOpen={() => onOpenPhoto(photo.id)}
                                    />
                                    {photo.illustration ? (
                                        <span className="sr-only">Destination illustration</span>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="flex h-full flex-col justify-center py-10">
                    <p className="font-display max-w-lg text-4xl leading-tight sm:text-6xl">
                        {activities.length ? "A day worth remembering." : "A little room to wander."}
                    </p>
                    <p className="text-muted-foreground mt-5 max-w-md text-sm leading-relaxed">
                        {activities.length
                            ? "Follow the stops on the map, and open an activity to read the details."
                            : "No activities are recorded for this day. Continue to the next chapter or explore the journey map."}
                    </p>
                </div>
            )}
        </section>
    );
}
