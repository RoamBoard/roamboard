"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import BoardPhoto from "./BoardPhoto";
import StoryPhoto from "./StoryPhoto";
import { sceneActivities } from "@/lib/board-story-scenes";
import type { BoardActivity } from "@/types/board";
import type { BoardAuthor, PublishedBoardDay } from "@/types/published-board";

export default function BoardStoryEnding({
    days,
    author,
    boardTitle,
    stats,
    saveAction,
    remixAction,
    actionFeedback,
    journeyMap,
    jump,
    onOpenActivity,
    onOpenPhoto
}: {
    days: PublishedBoardDay[];
    author: BoardAuthor;
    boardTitle: string;
    stats: ReactNode;
    saveAction: ReactNode;
    remixAction?: ReactNode;
    actionFeedback?: ReactNode;
    journeyMap?: ReactNode;
    jump: (id: string) => void;
    onOpenActivity: (activity: BoardActivity) => void;
    onOpenPhoto: (id: string) => void;
}) {
    return (
        <section
            id="ending"
            tabIndex={-1}
            className="mx-auto max-w-6xl scroll-mt-16 px-6 py-16 outline-none sm:px-12 sm:py-24"
        >
            <p className="text-muted-foreground text-center text-[10px] tracking-[0.2em] uppercase">Summary</p>
            <h2 className="font-display mx-auto mt-3 max-w-4xl text-center text-5xl font-bold sm:text-7xl">
                {boardTitle}
            </h2>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
                {saveAction}
                {remixAction}
            </div>
            <div className="text-center">{actionFeedback}</div>
            <div className="@container mx-auto mt-10 max-w-4xl">{stats}</div>
            <div className="mx-auto mt-10 max-w-4xl">
                {days.map((day) => {
                    const activities = sceneActivities(day);
                    // Prefer one photo per activity before filling any remaining miniature positions.
                    const allPhotos = activities.flatMap((activity) =>
                        activity.images.map((image, index) => ({
                            image,
                            id: `activity-${activity.id}-${index}`,
                            first: index === 0
                        }))
                    );
                    const photos = [
                        ...allPhotos.filter((photo) => photo.first),
                        ...allPhotos.filter((photo) => !photo.first)
                    ]
                        .filter(
                            (photo, index, all) => all.findIndex((other) => other.image.id === photo.image.id) === index
                        )
                        .slice(0, 3);
                    return (
                        <div
                            key={day.number}
                            className="border-line grid grid-cols-[4.5rem_1fr] gap-4 border-b py-6 sm:grid-cols-[6rem_1fr] sm:gap-6"
                        >
                            <a
                                href={`#day-${day.number}`}
                                onClick={(event) => {
                                    event.preventDefault();
                                    jump(`day-${day.number}`);
                                }}
                                className="font-display w-fit text-xl underline decoration-1 underline-offset-4"
                            >
                                Day {day.number}
                            </a>
                            <div>
                                {photos.length ? (
                                    <div
                                        aria-label={`Day ${day.number} photo summary`}
                                        className="mb-6 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4"
                                    >
                                        {photos.map((photo, index) => (
                                            <div key={photo.id} className={index === 1 ? "mt-4 min-w-0" : "min-w-0"}>
                                                <StoryPhoto
                                                    image={photo.image}
                                                    aspectRatio={index === 2 ? 4 / 3 : 1}
                                                    thumbnail
                                                    preservePortrait
                                                    portraitShape={index % 2 ? "square" : "tall"}
                                                    onOpen={() => onOpenPhoto(photo.id)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                                <ul className="space-y-2">
                                    {activities.map((activity) => (
                                        <li key={activity.id}>
                                            <button
                                                type="button"
                                                onClick={() => onOpenActivity(activity)}
                                                className="min-h-9 text-left text-sm hover:underline"
                                            >
                                                {activity.time ? (
                                                    <span className="text-muted-foreground mr-4 text-xs">
                                                        {activity.time}
                                                    </span>
                                                ) : null}
                                                {activity.title}
                                            </button>
                                        </li>
                                    ))}
                                    {!activities.length ? (
                                        <li className="text-muted-foreground text-xs">No recorded activities</li>
                                    ) : null}
                                </ul>
                            </div>
                        </div>
                    );
                })}
            </div>
            {journeyMap ? (
                <section aria-label="All Board locations" className="mx-auto max-w-4xl py-8 sm:py-12">
                    {journeyMap}
                </section>
            ) : null}
            <section
                aria-label="About the Board author"
                className="border-line mx-auto flex max-w-4xl flex-col items-start gap-8 border-t pt-12 sm:flex-row sm:gap-12"
            >
                <Link
                    href={`/profile/${encodeURIComponent(author.id)}`}
                    aria-label={`View ${author.name}'s profile`}
                    className="bg-faint block size-40 shrink-0 overflow-hidden sm:size-56"
                >
                    <BoardPhoto image={author.photo} className="size-full" sizes="(max-width: 640px) 160px, 224px" />
                </Link>
                <div>
                    <p className="text-muted-foreground mb-2 text-[10px] tracking-[0.18em] uppercase">
                        The person behind the journey
                    </p>
                    <Link
                        href={`/profile/${encodeURIComponent(author.id)}`}
                        className="font-display text-2xl font-semibold hover:underline"
                    >
                        @{author.name}
                    </Link>
                    {author.bio ? (
                        <p className="text-muted-foreground mt-3 max-w-lg text-sm leading-relaxed whitespace-pre-line">
                            {author.bio}
                        </p>
                    ) : null}
                </div>
            </section>
        </section>
    );
}
