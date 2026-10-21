"use client";
import BoardDialog from "./BoardDialog";
import StoryPhoto from "./StoryPhoto";
import type { BoardActivity } from "@/types/board";
import type { PublishedBoardDay } from "@/types/published-board";

export default function ActivityDetailsDialog({
    activity,
    days,
    onClose,
    onOpenPhoto,
    onFocusLocation
}: {
    activity: BoardActivity;
    days: PublishedBoardDay[];
    onClose: () => void;
    onOpenPhoto: (activity: BoardActivity, index: number) => void;
    onFocusLocation: (activity: BoardActivity) => void;
}) {
    const day =
        activity.dayNumber ?? days.find((day) => day.items.some((item) => item.id === activity.id))?.number ?? 1;
    return (
        <BoardDialog title={activity.title} onClose={onClose}>
            <p className="text-muted-foreground mb-5 text-sm">
                Day {day}
                {activity.date ? ` · ${activity.date}` : ""}
                {activity.time ? ` · ${activity.time}` : ""}
            </p>
            <div className="grid gap-5">
                {activity.images.map((image, index) => (
                    <StoryPhoto
                        key={`${image.id}-${index}`}
                        image={image}
                        onOpen={() => onOpenPhoto(activity, index)}
                    />
                ))}
            </div>
            {activity.description ? (
                <p className="mt-6 text-base leading-relaxed whitespace-pre-line">{activity.description}</p>
            ) : null}
            {activity.location ? (
                <div className="border-line mt-6 border-t pt-4">
                    <button
                        type="button"
                        onClick={() => onFocusLocation(activity)}
                        className="min-h-11 text-sm underline underline-offset-4"
                    >
                        {activity.location.name}
                    </button>
                    {activity.location.address ? (
                        <p className="text-muted-foreground text-xs">{activity.location.address}</p>
                    ) : null}
                </div>
            ) : null}
        </BoardDialog>
    );
}
