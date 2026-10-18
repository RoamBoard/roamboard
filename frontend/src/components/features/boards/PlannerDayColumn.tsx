/* eslint-disable @next/next/no-img-element */
"use client";

import { usePhotoUrls } from "@/lib/use-photo-urls";
import { ChevronRight, Plus } from "lucide-react";
import ActivityCategoryPicker from "@/components/features/boards/ActivityCategoryPicker";
import PinCategoryIcon from "@/components/ui/PinCategoryIcon";
import { dayColors, type BoardDayDraft, type BoardImageDraft, type BoardPinDraft } from "@/types/board-creator";

type Props = {
    day: BoardDayDraft;
    dayIndex: number;
    days: BoardDayDraft[];
    images: BoardImageDraft[];
    disabled: boolean;
    onOpenPin: (id: string) => void;
    onAdd: () => void;
    onRemoveDay: () => void;
    onMovePin: (id: string, dayId: string, time: string, index?: number) => void;
    onUpdatePin: (pin: BoardPinDraft) => void;
};

function dropTime(event: React.DragEvent<HTMLElement>): string {
    const container = event.currentTarget.querySelector("[data-planner-activities]") ?? event.currentTarget;
    const bounds = container.getBoundingClientRect();
    const offset = event.clientY - bounds.top;
    const ratio = Math.min(1, Math.max(0, offset / Math.max(1, container.scrollHeight)));
    const minutes = Math.round((360 + ratio * 1020) / 30) * 30;
    return `${String(Math.min(23, Math.floor(minutes / 60))).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export default function PlannerDayColumn({
    day,
    dayIndex,
    days,
    images,
    disabled,
    onOpenPin,
    onAdd,
    onRemoveDay,
    onMovePin,
    onUpdatePin
}: Props) {
    const photoUrl = usePhotoUrls();
    return (
        <article
            onDragOver={(event) => {
                if (!disabled) event.preventDefault();
            }}
            onDrop={(event) => {
                event.preventDefault();
                if (disabled) return;
                const pinId = event.dataTransfer.getData("text/roamboard-pin");
                if (pinId) onMovePin(pinId, day.id, dropTime(event));
            }}
            data-planner-day
            aria-labelledby={`day-${day.id}`}
            className="group/day border-line relative min-h-[26rem] w-[min(25rem,calc(100vw-6rem))] shrink-0 snap-start border-t"
        >
            <button
                type="button"
                disabled={disabled}
                aria-label={`Add an activity to day ${day.dayNumber}`}
                onClick={onAdd}
                className="hover:bg-faint/50 focus-visible:outline-foreground absolute inset-0 z-0 w-full cursor-pointer text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] motion-reduce:transition-none"
            />
            <div className="pointer-events-none relative px-2 pt-6 pb-8 [&_button]:pointer-events-auto">
                <header className="mb-8 flex items-start justify-between gap-4">
                    <div>
                        <span
                            aria-hidden="true"
                            className="mb-4 block h-1 w-8"
                            style={{ backgroundColor: dayColors[dayIndex % dayColors.length] }}
                        />
                        <h3 id={`day-${day.id}`} className="font-display text-30 font-bold tracking-[-0.025em]">
                            Day {String(day.dayNumber).padStart(2, "0")}
                        </h3>
                        <p className="text-muted-foreground mt-2 text-xs">
                            {day.pins.length} {day.pins.length === 1 ? "activity" : "activities"}
                            {day.date ? " / " + day.date : ""}
                        </p>
                    </div>
                    {days.length > 1 ? (
                        <button
                            type="button"
                            onClick={onRemoveDay}
                            disabled={disabled}
                            className="text-muted-foreground hover:text-foreground mt-5 min-h-9 px-2 text-[11px] underline underline-offset-4"
                        >
                            Remove day
                        </button>
                    ) : null}
                </header>
                <ol
                    data-planner-activities
                    className="relative min-h-40 pt-2 pb-8"
                    aria-label={`Day ${day.dayNumber} activities`}
                >
                    {day.pins.map((pin) => {
                        const photos = images
                            .filter((image) => image.pinId === pin.id)
                            .sort((a, b) => (a.activityOrder ?? a.order) - (b.activityOrder ?? b.order));
                        const image =
                            pin.coverImageId === null
                                ? photos.find((photo) => photo.source === "unsplash")
                                : (photos.find((photo) => photo.uploadedImageId === pin.coverImageId) ?? photos[0]);
                        return (
                            <li
                                key={pin.id}
                                draggable={!disabled}
                                onDragStartCapture={(event) => {
                                    if (disabled) {
                                        event.preventDefault();
                                        return;
                                    }
                                    event.dataTransfer.effectAllowed = "move";
                                    event.dataTransfer.setData("text/roamboard-pin", pin.id);
                                }}
                                className="pointer-events-auto relative mb-5 grid grid-cols-[3rem_minmax(0,1fr)] items-center sm:grid-cols-[3.5rem_minmax(0,1fr)]"
                            >
                                <span
                                    aria-hidden="true"
                                    className="border-line pointer-events-none absolute top-0 -bottom-7 left-9 border-l sm:left-12"
                                />
                                <time className="text-muted-foreground pr-3 text-right text-[9px] tabular-nums sm:pr-6 sm:text-[10px]">
                                    {pin.time || "—"}
                                </time>
                                <div className="relative min-w-0">
                                    <ActivityCategoryPicker
                                        pin={pin}
                                        disabled={disabled}
                                        onChange={(category) => onUpdatePin({ ...pin, category })}
                                    />
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => onOpenPin(pin.id)}
                                        id={`activity-${pin.id}`}
                                        aria-label={`Edit ${pin.title}`}
                                        className="group bg-faint/50 hover:bg-faint relative flex min-h-24 w-full cursor-grab items-stretch overflow-hidden rounded-xl text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 active:cursor-grabbing motion-reduce:transition-none"
                                    >
                                        {image ? (
                                            <img
                                                src={photoUrl(image.thumbnailUrl)}
                                                loading="lazy"
                                                decoding="async"
                                                width={80}
                                                height={96}
                                                alt=""
                                                className="w-16 shrink-0 object-cover sm:w-20"
                                            />
                                        ) : (
                                            <span className="bg-faint text-muted-foreground grid w-10 shrink-0 place-items-center sm:w-[3.75rem]">
                                                <PinCategoryIcon category={pin.category} className="size-5" />
                                            </span>
                                        )}
                                        <span className="flex min-w-0 flex-1 flex-col justify-center py-3 pr-2 pl-4 sm:pl-4">
                                            <strong className="text-foreground/80 line-clamp-2 text-xs leading-snug font-medium sm:text-sm">
                                                {pin.title}
                                            </strong>
                                            <span className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
                                                {pin.description || pin.location?.address || "Manual activity"}
                                            </span>
                                        </span>
                                        <ChevronRight
                                            aria-hidden="true"
                                            size={16}
                                            strokeWidth={1}
                                            className="text-muted-foreground mr-2 shrink-0 self-center sm:mr-4"
                                        />
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                    {day.pins.length === 0 ? (
                        <li className="text-muted-foreground grid min-h-48 content-center justify-items-center gap-4 px-6 text-center text-sm">
                            <Plus
                                aria-hidden="true"
                                className="size-7 opacity-50 transition-transform group-hover/day:rotate-90 motion-reduce:transition-none"
                                strokeWidth={1}
                            />
                            <p>Your next discovery starts here.</p>
                            <p className="text-xs">Click anywhere in this day to add an activity.</p>
                        </li>
                    ) : null}
                </ol>
                {day.pins.length ? (
                    <p className="text-muted-foreground mt-4 text-center text-[11px] opacity-60 group-hover/day:opacity-100">
                        Click an open space to add another activity
                    </p>
                ) : null}
            </div>
        </article>
    );
}
