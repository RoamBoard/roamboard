/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import PinCategoryIcon from "@/components/ui/PinCategoryIcon";
import {
    fromBoardDocument,
    loadBoardDocument,
    type BoardDocument
} from "@/lib/board-creator-api";
import { dayColors } from "@/types/board-creator";

export default function PublishedBoardView({
    boardId,
    initialBoard
}: {
    boardId: string;
    initialBoard?: BoardDocument;
}) {
    const [board, setBoard] = useState<BoardDocument | null>(
        initialBoard ?? null
    );
    const [error, setError] = useState("");

    useEffect(() => {
        if (initialBoard) return;
        void loadBoardDocument(Number(boardId))
            .then(setBoard)
            .catch((caught: unknown) =>
                setError(
                    caught instanceof Error
                        ? caught.message
                        : "The Board could not be loaded."
                )
            );
    }, [boardId, initialBoard]);

    if (error)
        return (
            <div className="px-6 py-20 sm:px-12">
                <p className="text-10 tracking-label text-stone uppercase">
                    Board inspector
                </p>
                <h1 className="font-display text-48 mt-4 font-bold">
                    Could not load Board
                </h1>
                <p className="text-14 text-graphite mt-4" role="alert">
                    {error}
                </p>
            </div>
        );
    if (!board)
        return (
            <div
                className="text-13 text-graphite grid min-h-[70dvh] place-items-center"
                role="status"
            >
                Loading Board…
            </div>
        );

    const restored = fromBoardDocument(board);
    const uploadedImages = restored.images.filter(
        (image) => image.source === "upload"
    );
    const cover = uploadedImages.find(
        (image) => image.uploadedImageId === board.coverImageId
    );
    const totalPins = restored.days.reduce(
        (sum, day) => sum + day.pins.length,
        0
    );

    return (
        <article className="px-5 py-16 sm:px-10 lg:px-16">
            <header className="border-line mx-auto max-w-7xl border-b pb-12">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="text-10 tracking-label text-stone font-bold uppercase">
                        Saved Itinerary · {board.status}
                    </p>
                    <span className="border-line text-10 tracking-label border px-3 py-1 uppercase">
                        {board.visibility}
                    </span>
                </div>
                <h1 className="font-display text-48 sm:text-72 mt-4 leading-none font-bold">
                    {board.title || "Untitled Board"}
                </h1>
                {board.description ? (
                    <p className="text-16 text-graphite mt-5 max-w-3xl leading-relaxed whitespace-pre-line">
                        {board.description}
                    </p>
                ) : null}
                <div className="text-12 text-graphite mt-6 flex flex-wrap items-center gap-6">
                    <span>
                        {restored.days.length} day
                        {restored.days.length === 1 ? "" : "s"}
                    </span>
                    <span>
                        {totalPins} pin{totalPins === 1 ? "" : "s"}
                    </span>
                    <span>
                        {restored.images.length} photo
                        {restored.images.length === 1 ? "" : "s"}
                    </span>
                    <span className="text-stone">
                        Board ID: {board.boardId}
                    </span>
                </div>
                {board.tags.length > 0 ? (
                    <div
                        className="mt-5 flex flex-wrap gap-2"
                        aria-label="Board tags"
                    >
                        {board.tags.map((tag) => (
                            <span
                                key={tag.tagId}
                                className="border-line bg-faint text-11 text-graphite border px-3 py-1"
                            >
                                #{tag.name}
                            </span>
                        ))}
                    </div>
                ) : null}
                {board.status === "published" &&
                board.permissions.canEditContent ? (
                    <div className="mt-8">
                        <Link
                            href={`/boards/${board.boardId}/edit`}
                            className="border-foreground text-14 hover:bg-foreground hover:text-background inline-block border px-6 py-3 font-medium transition-colors"
                        >
                            Edit Board
                        </Link>
                    </div>
                ) : null}
            </header>

            <div className="mx-auto mt-12 grid max-w-7xl gap-12 lg:grid-cols-[20rem_1fr]">
                <aside>
                    <p className="text-10 tracking-label text-graphite font-bold uppercase">
                        Board cover
                    </p>
                    <div className="border-line mt-4 overflow-hidden border">
                        {cover ? (
                            <img
                                src={cover.url}
                                alt={`Cover of ${board.title || "Untitled Board"}`}
                                className="aspect-[4/3] w-full object-cover"
                            />
                        ) : (
                            <div className="bg-faint text-12 text-graphite grid aspect-[4/3] place-items-center">
                                Default cover
                            </div>
                        )}
                    </div>
                </aside>

                <main className="space-y-12">
                    {restored.days.map((day, dayIndex) => {
                        const dayColor = dayColors[dayIndex % dayColors.length];
                        return (
                            <section
                                key={day.id}
                                aria-labelledby={`day-heading-${day.id}`}
                                className="border-line border-t pt-6"
                                style={{
                                    borderTopColor: dayColor,
                                    borderTopWidth: 3
                                }}
                            >
                                <div className="flex flex-wrap items-baseline justify-between gap-4">
                                    <h2
                                        id={`day-heading-${day.id}`}
                                        className="font-display text-28 font-bold"
                                    >
                                        Day {day.dayNumber}
                                    </h2>
                                    <div className="text-12 text-graphite flex gap-3">
                                        {day.date ? (
                                            <time dateTime={day.date}>
                                                {day.date}
                                            </time>
                                        ) : null}
                                        <span>
                                            {day.pins.length}{" "}
                                            {day.pins.length === 1
                                                ? "activity"
                                                : "activities"}
                                        </span>
                                    </div>
                                </div>

                                {day.pins.length === 0 ? (
                                    <p className="text-13 text-graphite mt-6 italic">
                                        No activities planned for this day.
                                    </p>
                                ) : (
                                    <ol className="mt-6 space-y-6">
                                        {day.pins.map((pin) => {
                                            const pinImages = restored.images
                                                .filter(
                                                    (image) =>
                                                        image.pinId === pin.id
                                                )
                                                .sort(
                                                    (first, second) =>
                                                        (first.activityOrder ??
                                                            first.order) -
                                                        (second.activityOrder ??
                                                            second.order)
                                                );
                                            const locationParts = pin.location
                                                ? [
                                                      pin.location.name !==
                                                      pin.title
                                                          ? pin.location.name
                                                          : null,
                                                      pin.location.address,
                                                      pin.location.city,
                                                      pin.location.country
                                                  ].filter(Boolean)
                                                : [];
                                            const locationDisplay =
                                                locationParts.join(" · ");

                                            return (
                                                <li
                                                    key={pin.id}
                                                    className="border-line border-b pb-6 last:border-b-0"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <span
                                                            className="bg-faint text-graphite grid size-8 shrink-0 place-items-center rounded-sm"
                                                            title={pin.category}
                                                        >
                                                            <PinCategoryIcon
                                                                category={
                                                                    pin.category
                                                                }
                                                                className="size-4"
                                                            />
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                                                <h3 className="font-display text-foreground text-18 font-bold">
                                                                    {pin.title}
                                                                </h3>
                                                                {pin.time ? (
                                                                    <time className="text-stone text-12 font-mono">
                                                                        {
                                                                            pin.time
                                                                        }
                                                                    </time>
                                                                ) : null}
                                                            </div>

                                                            {locationDisplay ? (
                                                                <p className="text-12 text-graphite mt-1 flex items-center gap-1">
                                                                    <span>
                                                                        📍
                                                                    </span>
                                                                    <span>
                                                                        {
                                                                            locationDisplay
                                                                        }
                                                                    </span>
                                                                </p>
                                                            ) : null}

                                                            {pin.description ? (
                                                                <p className="text-foreground text-13 mt-2 leading-relaxed whitespace-pre-line">
                                                                    {
                                                                        pin.description
                                                                    }
                                                                </p>
                                                            ) : null}

                                                            {pinImages.length >
                                                            0 ? (
                                                                <div
                                                                    className="mt-3 flex flex-wrap gap-2"
                                                                    aria-label={`Photos for ${pin.title}`}
                                                                >
                                                                    {pinImages.map(
                                                                        (
                                                                            image
                                                                        ) => (
                                                                            <img
                                                                                key={
                                                                                    image.id
                                                                                }
                                                                                src={
                                                                                    image.thumbnailUrl
                                                                                }
                                                                                alt={`${pin.title} photo`}
                                                                                className="border-line aspect-square size-20 rounded-sm border object-cover"
                                                                            />
                                                                        )
                                                                    )}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                )}
                            </section>
                        );
                    })}
                </main>
            </div>
        </article>
    );
}
