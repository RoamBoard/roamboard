"use client";

import { usePhotoUrls } from "@/lib/use-photo-urls";
import { ChevronRight, GripVertical, Palette, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { dayColor } from "@/lib/day-color";
import CroppedPhoto from "@/components/images/CroppedPhoto";
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
    onColorChange: (color: string) => void;
    dragTarget: { dayId: string; index: number } | null;
    onDragTargetChange: (target: { dayId: string; index: number } | null) => void;
};

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
    onColorChange,
    dragTarget,
    onDragTargetChange
}: Props) {
    const photoUrl = usePhotoUrls();
    const [choosingColor, setChoosingColor] = useState(false);
    const dropIndex = dragTarget?.dayId === day.id ? dragTarget.index : null;
    const touch = useRef<{ x: number; y: number; moved: boolean } | null>(null);
    function setDropIndex(index: number | null) {
        onDragTargetChange(index === null ? null : { dayId: day.id, index });
    }
    const color = dayColor(day, dayIndex);
    return (
        <li
            onDragOver={(event) => {
                if (disabled || !event.dataTransfer.types.includes("text/roamboard-pin")) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                const cards = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-activity-row]"));
                const index = cards.findIndex(
                    (card) => event.clientY < card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2
                );
                setDropIndex(index < 0 ? cards.length : index);
            }}
            onDrop={(event) => {
                event.preventDefault();
                if (disabled) return;
                const pinId = event.dataTransfer.getData("text/roamboard-pin");
                const activity = days.flatMap((item) => item.pins).find((pin) => pin.id === pinId);
                if (activity) {
                    const sourceIndex = day.pins.findIndex((pin) => pin.id === pinId);
                    const index = dropIndex ?? day.pins.length;
                    onMovePin(
                        pinId,
                        day.id,
                        activity.time,
                        sourceIndex >= 0 && sourceIndex < index ? index - 1 : index
                    );
                }
                setDropIndex(null);
            }}
            onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropIndex(null);
            }}
            onDragEnd={() => setDropIndex(null)}
            style={{
                backgroundColor: `color-mix(in srgb, ${color} 6%, var(--background))`,
                borderColor: dropIndex !== null ? color : undefined
            }}
            data-planner-day={day.id}
            aria-labelledby={`day-${day.id}`}
            className="group/day border-line relative min-h-[26rem] w-full shrink-0 rounded-3xl border p-4 transition-[border-color,background-color] duration-200 md:w-[min(25rem,calc(100vw-6rem))]"
        >
            <button
                type="button"
                disabled={disabled}
                aria-label={`Add an activity to day ${day.dayNumber}`}
                onClick={onAdd}
                className="hover:bg-faint/50 focus-visible:outline-foreground absolute inset-0 z-0 w-full cursor-pointer text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] motion-reduce:transition-none"
            />
            <div className="pointer-events-none relative px-2 pt-6 pb-8 [&_button]:pointer-events-auto">
                <div className="pointer-events-auto mb-2 flex justify-end">
                    <button
                        type="button"
                        aria-label={`Choose color for day ${day.dayNumber}`}
                        aria-expanded={choosingColor}
                        onClick={() => setChoosingColor(!choosingColor)}
                        className="editor-icon-action"
                        disabled={disabled}
                    >
                        <Palette size={16} />
                    </button>
                </div>
                {choosingColor ? (
                    <div
                        role="group"
                        aria-label={`Day ${day.dayNumber} colors`}
                        className="bg-background border-line pointer-events-auto mb-5 grid grid-cols-6 gap-2 rounded-2xl border p-3"
                    >
                        {dayColors.map((choice, index) => (
                            <button
                                key={choice}
                                type="button"
                                disabled={disabled}
                                aria-label={`Day color ${index + 1}`}
                                aria-pressed={(day.color ?? dayColors[dayIndex % dayColors.length]) === choice}
                                onClick={() => {
                                    onColorChange(choice);
                                    setChoosingColor(false);
                                }}
                                className="aria-pressed:border-foreground aspect-square min-h-8 rounded-full border-2 border-transparent transition-transform hover:scale-110 focus-visible:outline-2 motion-reduce:transition-none"
                                style={{ backgroundColor: dayColor({ color: choice }, 0) }}
                            />
                        ))}
                    </div>
                ) : null}
                <header className="mb-8 flex items-start justify-between gap-4">
                    <div>
                        <span aria-hidden="true" className="mb-4 block h-1 w-8" style={{ backgroundColor: color }} />
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
                            className="group/action text-muted-foreground hover:text-foreground mt-5 flex min-h-10 items-center gap-2 text-xs"
                        >
                            <Trash2
                                aria-hidden="true"
                                size={16}
                                className="transition-transform group-hover/action:scale-110 motion-reduce:transition-none"
                            />{" "}
                            Remove day
                        </button>
                    ) : null}
                </header>
                <ol
                    data-planner-activities
                    className="relative min-h-40 pt-2 pb-8"
                    aria-label={`Day ${day.dayNumber} activities`}
                >
                    {day.pins.map((pin, pinIndex) => {
                        const photos = images
                            .filter((image) => image.pinId === pin.id)
                            .sort((a, b) => (a.activityOrder ?? a.order) - (b.activityOrder ?? b.order));
                        const image =
                            (pin.coverPhoto
                                ? photos.find((photo) =>
                                      pin.coverPhoto?.source === "upload"
                                          ? photo.uploadedImageId === pin.coverPhoto.imageId
                                          : photo.source === "unsplash" &&
                                            photo.publicId === pin.coverPhoto?.providerImageId
                                  )
                                : undefined) ??
                            (pin.coverImageId === null
                                ? photos.find((photo) => photo.source === "unsplash")
                                : (photos.find((photo) => photo.uploadedImageId === pin.coverImageId) ?? photos[0]));
                        return (
                            <li
                                data-activity-row
                                style={{ paddingTop: dropIndex === pinIndex ? 48 : 0 }}
                                key={pin.id}
                                draggable={!disabled}
                                onDragStartCapture={(event) => {
                                    if (disabled) {
                                        event.preventDefault();
                                        return;
                                    }
                                    event.dataTransfer.effectAllowed = "move";
                                    event.dataTransfer.setData("text/roamboard-pin", pin.id);
                                    // Embla cancels bubbling dragstart events even when watchDrag declines the gesture.
                                    event.stopPropagation();
                                }}
                                className={`pointer-events-auto relative mb-5 grid items-center transition-[padding] duration-200 motion-reduce:transition-none ${pin.time ? "grid-cols-[2.5rem_minmax(0,1fr)]" : "grid-cols-1"}`}
                            >
                                {pin.time ? (
                                    <time className="text-muted-foreground pr-3 text-right text-[9px] tabular-nums sm:pr-6 sm:text-[10px]">
                                        {pin.time}
                                    </time>
                                ) : null}
                                <div className="relative min-w-0">
                                    <button
                                        type="button"
                                        tabIndex={-1}
                                        aria-label={`Drag ${pin.title}`}
                                        disabled={disabled}
                                        className="text-muted-foreground hover:text-foreground absolute right-1 bottom-1 z-10 grid size-8 touch-none place-items-center rounded-full transition-transform hover:scale-110 motion-reduce:transition-none"
                                        onPointerDown={(event) => {
                                            if (event.pointerType !== "touch" || disabled) return;
                                            event.stopPropagation();
                                            touch.current = { x: event.clientX, y: event.clientY, moved: false };
                                            event.currentTarget.setPointerCapture(event.pointerId);
                                        }}
                                        onPointerMove={(event) => {
                                            const start = touch.current;
                                            if (!start) return;
                                            if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8)
                                                return;
                                            start.moved = true;
                                            const target = document
                                                .elementFromPoint(event.clientX, event.clientY)
                                                ?.closest<HTMLElement>("[data-planner-day]");
                                            if (!target) {
                                                onDragTargetChange(null);
                                                return;
                                            }
                                            const rows = Array.from(
                                                target.querySelectorAll<HTMLElement>("[data-activity-row]")
                                            );
                                            const index = rows.findIndex(
                                                (row) =>
                                                    event.clientY <
                                                    row.getBoundingClientRect().top +
                                                        row.getBoundingClientRect().height / 2
                                            );
                                            onDragTargetChange({
                                                dayId: target.dataset.plannerDay!,
                                                index: index < 0 ? rows.length : index
                                            });
                                        }}
                                        onPointerUp={() => {
                                            if (touch.current?.moved && dragTarget) {
                                                const sourceIndex = dragTarget.dayId === day.id ? pinIndex : -1;
                                                onMovePin(
                                                    pin.id,
                                                    dragTarget.dayId,
                                                    pin.time,
                                                    sourceIndex >= 0 && sourceIndex < dragTarget.index
                                                        ? dragTarget.index - 1
                                                        : dragTarget.index
                                                );
                                            }
                                            touch.current = null;
                                            onDragTargetChange(null);
                                        }}
                                        onPointerCancel={() => {
                                            touch.current = null;
                                            onDragTargetChange(null);
                                        }}
                                    >
                                        <GripVertical aria-hidden="true" size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => onOpenPin(pin.id)}
                                        id={`activity-${pin.id}`}
                                        aria-describedby="activity-drag-hint"
                                        onKeyDown={(event) => {
                                            if (disabled) return;
                                            if (!event.shiftKey && ["ArrowUp", "ArrowDown"].includes(event.key)) {
                                                event.preventDefault();
                                                const index = pinIndex + (event.key === "ArrowUp" ? -1 : 1);
                                                if (index >= 0 && index < day.pins.length)
                                                    onMovePin(pin.id, day.id, pin.time, index);
                                            } else if (
                                                event.shiftKey &&
                                                ["ArrowLeft", "ArrowRight"].includes(event.key)
                                            ) {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                const target = days[dayIndex + (event.key === "ArrowLeft" ? -1 : 1)];
                                                if (target) onMovePin(pin.id, target.id, pin.time, target.pins.length);
                                            }
                                        }}
                                        aria-label={`Edit ${pin.title}`}
                                        className="group bg-faint/50 hover:bg-faint relative flex min-h-24 w-full cursor-grab items-stretch overflow-hidden rounded-xl text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 active:cursor-grabbing motion-reduce:transition-none"
                                    >
                                        {image ? (
                                            <CroppedPhoto
                                                thumbnail
                                                presentation={image.presentation}
                                                src={photoUrl(image.thumbnailUrl)}
                                                loading="lazy"
                                                decoding="async"
                                                width={80}
                                                height={96}
                                                alt=""
                                                draggable={false}
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
                    {dropIndex === day.pins.length && day.pins.length > 0 ? (
                        <li
                            aria-hidden="true"
                            className="h-12 rounded-xl border-2 border-dashed"
                            style={{ borderColor: color }}
                        />
                    ) : null}
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
        </li>
    );
}
