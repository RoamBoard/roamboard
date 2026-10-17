/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowUp, ChevronRight, MoreHorizontal, Plus, Sun } from "lucide-react";
import ActivityCategoryPicker from "@/components/features/boards/ActivityCategoryPicker";
import PinCategoryIcon from "@/components/ui/PinCategoryIcon";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
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
    onReorderPin: (id: string, direction: -1 | 1) => void;
    onUpdatePin: (pin: BoardPinDraft) => void;
    confirmedPhotoPins: Set<string>;
    onConfirmPhotoPin: (id: string) => void;
};

function dropTime(event: React.DragEvent<HTMLElement>): string {
    const bounds = event.currentTarget.getBoundingClientRect();
    const offset = event.clientY - bounds.top + event.currentTarget.scrollTop;
    const ratio = Math.min(1, Math.max(0, offset / event.currentTarget.scrollHeight));
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
    onReorderPin,
    onUpdatePin,
    confirmedPhotoPins,
    onConfirmPhotoPin
}: Props) {
    const scrollerRef = useRef<HTMLOListElement>(null);
    const reducedMotion = useReducedMotion();
    function scroll(top: number) {
        scrollerRef.current?.scrollBy({ top, behavior: reducedMotion ? "auto" : "smooth" });
    }
    return (
        <article className="w-[min(30rem,calc(100vw-7rem))] shrink-0 snap-start" aria-labelledby={`day-${day.id}`}>
            <header className="border-line mb-6 flex min-h-20 items-end justify-between gap-3 border-b pb-4 pl-12">
                <div className="text-muted-foreground text-xs">
                    <span
                        aria-hidden="true"
                        className="mb-3 block h-1 w-8"
                        style={{ backgroundColor: dayColors[dayIndex % dayColors.length] }}
                    />
                    {day.date ? <time dateTime={day.date}>{day.date}</time> : <span>Date open</span>}
                </div>
                <div className="text-right">
                    <h3 id={`day-${day.id}`} className="text-foreground/80 text-24 sm:text-30 leading-none font-bold">
                        DAY {day.dayNumber}
                    </h3>
                    {days.length > 1 ? (
                        <button
                            type="button"
                            onClick={onRemoveDay}
                            disabled={disabled}
                            className="text-muted-foreground hover:text-foreground mt-2 min-h-8 text-[11px] underline underline-offset-4"
                        >
                            remove day
                        </button>
                    ) : null}
                </div>
            </header>
            <div className="mb-2 flex items-center justify-between pl-12">
                <p className="text-muted-foreground text-[10px]">
                    {day.pins.length} {day.pins.length === 1 ? "activity" : "activities"}
                </p>
                <div className="flex">
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => scroll(-260)}
                        className="hover:bg-faint grid size-11 place-items-center"
                        aria-label={`Scroll day ${day.dayNumber} activities up`}
                    >
                        <ArrowUp size={14} />
                    </button>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => scroll(260)}
                        className="hover:bg-faint grid size-11 place-items-center"
                        aria-label={`Scroll day ${day.dayNumber} activities down`}
                    >
                        <ArrowDown size={14} />
                    </button>
                </div>
            </div>
            <ol
                ref={scrollerRef}
                className="relative h-[min(38rem,70svh)] min-h-72 overflow-y-auto overscroll-y-contain px-1 pt-3 pb-12"
                aria-label={`Day ${day.dayNumber} activities`}
                onDragOver={(event) => {
                    if (!disabled) event.preventDefault();
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    if (disabled) return;
                    const pinId = event.dataTransfer.getData("text/roamboard-pin");
                    if (pinId) onMovePin(pinId, day.id, dropTime(event));
                }}
            >
                {day.pins.map((pin, index) => {
                    const photos = images
                        .filter((image) => image.pinId === pin.id)
                        .sort((a, b) => (a.activityOrder ?? a.order) - (b.activityOrder ?? b.order));
                    const image =
                        pin.coverImageId === null
                            ? photos.find((photo) => photo.source === "unsplash")
                            : (photos.find((photo) => photo.uploadedImageId === pin.coverImageId) ?? photos[0]);
                    return (
                        <motion.li
                            key={pin.id}
                            layout={reducedMotion ? false : "position"}
                            initial={false}
                            transition={{ duration: reducedMotion ? 0 : 0.18 }}
                            draggable={!disabled}
                            onDragStartCapture={(event) => {
                                if (disabled) {
                                    event.preventDefault();
                                    return;
                                }
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("text/roamboard-pin", pin.id);
                            }}
                            className="relative mb-7 grid grid-cols-[3rem_minmax(0,1fr)] items-center sm:grid-cols-[4rem_minmax(0,1fr)]"
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
                                    aria-label={`Edit ${pin.title}`}
                                    className="group border-line bg-background hover:border-foreground/50 relative flex min-h-20 w-full cursor-grab items-stretch border text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 active:cursor-grabbing motion-reduce:transition-none"
                                >
                                    {image ? (
                                        <img
                                            src={image.thumbnailUrl}
                                            alt=""
                                            className="w-12 shrink-0 object-cover sm:w-[3.75rem]"
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
                                        <span className="text-muted-foreground mt-1 line-clamp-2 text-[10px] leading-relaxed">
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
                                {pin.source === "photo" && !confirmedPhotoPins.has(pin.id) ? (
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => onConfirmPhotoPin(pin.id)}
                                        className="text-foreground mt-2 min-h-8 text-[11px] underline underline-offset-4"
                                    >
                                        confirm photo location
                                    </button>
                                ) : null}
                            </div>
                            <div className="col-start-2 flex justify-end">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            id={`move-${pin.id}`}
                                            type="button"
                                            disabled={disabled}
                                            aria-label={`Move ${pin.title}`}
                                            className="text-muted-foreground hover:text-foreground grid h-8 w-11 place-items-center focus-visible:outline-2"
                                        >
                                            <MoreHorizontal size={16} />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="w-52 rounded-none"
                                        aria-label={`Move ${pin.title}`}
                                    >
                                        <DropdownMenuItem
                                            disabled={index === 0 || disabled}
                                            onSelect={() => onReorderPin(pin.id, -1)}
                                            className="min-h-11"
                                        >
                                            <ArrowUp size={14} /> Move earlier
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            disabled={index === day.pins.length - 1 || disabled}
                                            onSelect={() => onReorderPin(pin.id, 1)}
                                            className="min-h-11"
                                        >
                                            <ArrowDown size={14} /> Move later
                                        </DropdownMenuItem>
                                        {days.length > 1 ? <DropdownMenuSeparator /> : null}
                                        {days
                                            .filter((other) => other.id !== day.id)
                                            .map((other) => (
                                                <DropdownMenuItem
                                                    key={other.id}
                                                    disabled={disabled}
                                                    className="min-h-11"
                                                    onSelect={() =>
                                                        onMovePin(pin.id, other.id, pin.time, other.pins.length)
                                                    }
                                                >
                                                    Move to day {other.dayNumber}
                                                </DropdownMenuItem>
                                            ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </motion.li>
                    );
                })}
                {day.pins.length === 0 ? (
                    <li className="border-line text-muted-foreground ml-12 grid min-h-64 content-center justify-items-center gap-4 border border-dashed px-5 text-center text-xs leading-relaxed">
                        <Sun aria-hidden="true" size={24} strokeWidth={1} />
                        <p>A day with room to roam.</p>
                        <p>Add your first activity, or drop one here from another day.</p>
                    </li>
                ) : null}
            </ol>
            <button
                type="button"
                disabled={disabled}
                onClick={onAdd}
                className="text-muted-foreground hover:text-foreground mt-3 ml-12 inline-flex min-h-11 items-center gap-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-4"
            >
                <Plus aria-hidden="true" size={14} /> Add activity
                <span className="sr-only"> to day {day.dayNumber}</span>
            </button>
        </article>
    );
}
