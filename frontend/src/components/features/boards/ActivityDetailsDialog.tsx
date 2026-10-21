"use client";

import { useState, type ReactNode } from "react";
import BoardDialog from "@/components/features/boards/BoardDialog";
import BoardIcon from "@/components/features/boards/BoardIcon";
import BoardPhoto from "@/components/features/boards/BoardPhoto";
import ImageZoomDialog from "@/components/ui/ImageZoomDialog";
import type { BoardActivity, BoardImage } from "@/types/board";
import type { PublishedBoardDay } from "@/types/published-board";

type Props = {
    activity: BoardActivity;
    days: PublishedBoardDay[];
    saved: boolean;
    onClose: () => void;
    onSave: () => void;
    onCopy: () => void;
    children: ReactNode;
};

const actionClasses =
    "border-line hover:bg-faint inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 border px-5 py-2 text-14 focus-visible:outline-2 focus-visible:outline-offset-4";

function ActivityPhotoGallery({ images }: { images: BoardImage[] }) {
    const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);

    return (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
            {images.map((image, index) => (
                <figure key={`${image.id}-${index}`}>
                    <BoardPhoto
                        image={image}
                        className="aspect-[4/3]"
                        zoomable
                        onZoom={() => setZoomedIndex(index)}
                    />
                    {image.photographer ? (
                        <figcaption className="text-muted-foreground text-12 mt-2">
                            Photo by{" "}
                            {image.photographerUrl ? (
                                <a
                                    href={image.photographerUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline underline-offset-4"
                                >
                                    {image.photographer}
                                </a>
                            ) : (
                                image.photographer
                            )}
                            {image.sourceUrl ? (
                                <>
                                    {" "}
                                    on{" "}
                                    <a
                                        href={image.sourceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="underline underline-offset-4"
                                    >
                                        Unsplash
                                    </a>
                                </>
                            ) : null}
                        </figcaption>
                    ) : null}
                </figure>
            ))}
            {zoomedIndex !== null && (
                <ImageZoomDialog
                    images={images}
                    initialIndex={zoomedIndex}
                    onClose={() => setZoomedIndex(null)}
                />
            )}
        </div>
    );
}

// This component displays the selected activity. PublishedBoard decides when it opens.
export default function ActivityDetailsDialog({ activity, days, saved, onClose, onSave, onCopy, children }: Props) {
    // Use the activity's day if it has one, otherwise find the day it belongs to.
    const dayNumber =
        activity.dayNumber ?? days.find((day) => day.items.some((item) => item.id === activity.id))?.number ?? 1;
    const date = days.find((day) => day.number === dayNumber)?.date ?? activity.date;

    return (
        <BoardDialog title={activity.title} onClose={onClose}>
            <p className="text-muted-foreground text-14 mb-5">
                Day {dayNumber}
                {date ? (
                    <>
                        {" · "}
                        <time dateTime={date}>{date}</time>
                    </>
                ) : null}
                {activity.time ? ` · ${activity.time}` : ""}
            </p>
            {/* Show every photo here; the card only shows the first one. */}
            {activity.images.length ? <ActivityPhotoGallery images={activity.images} /> : null}
            {activity.description ? (
                <p className="text-16 leading-relaxed whitespace-pre-line">{activity.description}</p>
            ) : null}
            {activity.location ? (
                <div className="border-line mt-6 border-t pt-5">
                    <p className="text-14 font-semibold">{activity.location.name}</p>
                    {activity.location.address ? (
                        <p className="text-muted-foreground text-14 mt-1">{activity.location.address}</p>
                    ) : null}
                </div>
            ) : null}
            {/* The parent handles saving and copying, so this popup just calls it. */}
            <div className="mt-7 flex flex-wrap gap-3">
                <button type="button" onClick={onSave} aria-pressed={saved} className={actionClasses}>
                    <BoardIcon name="bookmark" className="size-4" />
                    {saved ? "Remove saved activity" : "Save activity"}
                </button>
                <button type="button" onClick={onCopy} className={actionClasses}>
                    <BoardIcon name="copy" className="size-4" />
                    Copy to my preview board
                </button>
            </div>
            <p className="text-muted-foreground text-12 mt-4">
                Preview only. Saving stores this activity in this tab; copying opens an editable board copy. No database
                changes are made.
            </p>
            {/* The parent passes save messages and errors into this space. */}
            {children}
        </BoardDialog>
    );
}

