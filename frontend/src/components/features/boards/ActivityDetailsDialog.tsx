"use client";

import type { ReactNode } from "react";
import BoardDialog from "@/components/features/boards/BoardDialog";
import BoardIcon from "@/components/features/boards/BoardIcon";
import BoardPhoto from "@/components/features/boards/BoardPhoto";
import type { BoardActivity } from "@/types/board";
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

// This component displays the selected activity. PublishedBoard decides when it opens.
export default function ActivityDetailsDialog({
    activity,
    days,
    saved,
    onClose,
    onSave,
    onCopy,
    children
}: Props) {
    const dayNumber =
        activity.dayNumber ??
        days.find((day) => day.items.some((item) => item.id === activity.id))
            ?.number ??
        1;

    return (
        <BoardDialog title={activity.title} onClose={onClose}>
            <p className="text-muted-foreground text-14 mb-5">
                Day {dayNumber}
                {activity.time ? ` · ${activity.time}` : ""}
            </p>
            {activity.images.length ? (
                <div className="mb-6 grid gap-4 sm:grid-cols-2">
                    {activity.images.map((image, index) => (
                        <BoardPhoto
                            key={`${image.id}-${index}`}
                            image={image}
                            className="aspect-[4/3]"
                        />
                    ))}
                </div>
            ) : null}
            {activity.description ? (
                <p className="text-16 leading-relaxed whitespace-pre-line">
                    {activity.description}
                </p>
            ) : null}
            {activity.location ? (
                <div className="border-line mt-6 border-t pt-5">
                    <p className="text-14 font-semibold">
                        {activity.location.name}
                    </p>
                    {activity.location.address ? (
                        <p className="text-muted-foreground text-14 mt-1">
                            {activity.location.address}
                        </p>
                    ) : null}
                </div>
            ) : null}
            <div className="mt-7 flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={onSave}
                    aria-pressed={saved}
                    className={actionClasses}
                >
                    <BoardIcon name="bookmark" className="size-4" />
                    {saved ? "Remove saved activity" : "Save activity"}
                </button>
                <button
                    type="button"
                    onClick={onCopy}
                    className={actionClasses}
                >
                    <BoardIcon name="copy" className="size-4" />
                    Copy to my preview board
                </button>
            </div>
            <p className="text-muted-foreground text-12 mt-4">
                Preview only. Saving stores this activity in this tab; copying
                opens an editable board copy. No database changes are made.
            </p>
            {children}
        </BoardDialog>
    );
}
