"use client";

import { useRef, useState } from "react";

import AddPinDialog from "@/components/features/boards/AddPinDialog";
import PinEditorDialog from "@/components/features/boards/PinEditorDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PlannerDayColumn from "@/components/features/boards/PlannerDayColumn";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { type BoardDayDraft, type BoardImageDraft, type BoardPinDraft } from "@/types/board-creator";

type Props = {
    disabled?: boolean;
    days: BoardDayDraft[];
    images: BoardImageDraft[];
    onAddDay: () => void;
    onRemoveDay: (dayId: string) => void;
    onAddPin: (dayId: string, pin: BoardPinDraft, image: BoardImageDraft | null) => void;
    onUpdatePin: (pin: BoardPinDraft) => void;
    onMovePin: (pinId: string, dayId: string, time: string, index?: number) => void;
    onReorderPin: (pinId: string, direction: -1 | 1) => void;
    onRemovePin: (pinId: string) => void;
    onAddActivityImage: (image: BoardImageDraft) => void;
    onAssignActivityImage: (imageId: string, pinId: string | null) => void;
    onSetActivityCover: (pinId: string, imageId: number | null) => void;
    onReorderActivityImage: (pinId: string, imageId: string, direction: -1 | 1) => void;
    confirmedPhotoPins: Set<string>;
    onConfirmPhotoPin: (pinId: string) => void;
};

function scrollBehavior(): ScrollBehavior {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export default function DayPlanner({
    disabled = false,
    days,
    images,
    onAddDay,
    onRemoveDay,
    onAddPin,
    onUpdatePin,
    onMovePin,
    onReorderPin,
    onRemovePin,
    onAddActivityImage,
    onAssignActivityImage,
    onSetActivityCover,
    onReorderActivityImage,
    confirmedPhotoPins,
    onConfirmPhotoPin
}: Props) {
    const stripRef = useRef<HTMLDivElement>(null);
    const [dialogDayId, setDialogDayId] = useState<string | null>(null);
    const [editingPinId, setEditingPinId] = useState<string | null>(null);
    const [removingDayId, setRemovingDayId] = useState<string | null>(null);
    const [announcement, setAnnouncement] = useState("");
    const dialogDay = days.find((day) => day.id === dialogDayId) ?? null;
    const editingPin = days.flatMap((day) => day.pins).find((pin) => pin.id === editingPinId) ?? null;
    const removingDay = days.find((day) => day.id === removingDayId) ?? null;

    function requestRemoveDay(day: BoardDayDraft) {
        if (disabled || days.length === 1) return;
        if (day.pins.length === 0) onRemoveDay(day.id);
        else setRemovingDayId(day.id);
    }

    function openExistingPin(pinId: string) {
        if (disabled) return;
        setDialogDayId(null);
        setEditingPinId(pinId);
    }

    function announceMove(pinId: string, text: string) {
        setAnnouncement(text);
        requestAnimationFrame(() => {
            document.getElementById(`move-${pinId}`)?.focus();
        });
    }

    return (
        <fieldset
            disabled={disabled}
            className="m-0 min-w-0 border-0 p-0 disabled:pointer-events-none disabled:opacity-80"
        >
            <div className="border-line mb-4 flex items-center justify-between gap-3 border-b pb-4">
                <p className="text-muted-foreground text-xs">
                    {days.length} {days.length === 1 ? "day" : "days"} to make your own
                </p>
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={() =>
                            stripRef.current?.scrollBy({
                                left: -stripRef.current.clientWidth * 0.85,
                                behavior: scrollBehavior()
                            })
                        }
                        className="border-line hover:bg-faint grid size-11 place-items-center rounded-full border focus-visible:outline-2 focus-visible:outline-offset-2"
                        aria-label="Previous days"
                    >
                        <ArrowLeft size={16} strokeWidth={1.5} />
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            stripRef.current?.scrollBy({
                                left: stripRef.current.clientWidth * 0.85,
                                behavior: scrollBehavior()
                            })
                        }
                        className="border-line hover:bg-faint grid size-11 place-items-center rounded-full border focus-visible:outline-2 focus-visible:outline-offset-2"
                        aria-label="Next days"
                    >
                        <ArrowRight size={16} strokeWidth={1.5} />
                    </button>
                </div>
            </div>
            <div
                ref={stripRef}
                className="flex snap-x snap-mandatory items-start gap-7 overflow-x-auto pb-6 sm:gap-10"
                aria-label="Board day plans"
            >
                {days.map((day, dayIndex) => (
                    <PlannerDayColumn
                        key={day.id}
                        day={day}
                        dayIndex={dayIndex}
                        images={images}
                        onOpenPin={openExistingPin}
                        onAdd={() => setDialogDayId(day.id)}
                        onRemoveDay={() => requestRemoveDay(day)}
                        days={days}
                        disabled={disabled}
                        onUpdatePin={onUpdatePin}
                        onReorderPin={(pinId, direction) => {
                            if (disabled) return;
                            onReorderPin(pinId, direction);
                            const title = day.pins.find((pin) => pin.id === pinId)?.title ?? "Activity";
                            announceMove(
                                pinId,
                                `${title} moved ${direction === -1 ? "earlier" : "later"} in day ${day.dayNumber}. Time unchanged.`
                            );
                        }}
                        onMovePin={(pinId, dayId, time, index) => {
                            if (disabled) return;
                            onMovePin(pinId, dayId, time, index);
                            const target = days.find((item) => item.id === dayId);
                            announceMove(
                                pinId,
                                `Activity moved to day ${target?.dayNumber ?? ""} at ${time || "an open time"}.`
                            );
                        }}
                        confirmedPhotoPins={confirmedPhotoPins}
                        onConfirmPhotoPin={onConfirmPhotoPin}
                    />
                ))}
                <button
                    type="button"
                    onClick={onAddDay}
                    className="border-line text-muted-foreground hover:border-foreground hover:text-foreground mt-20 flex min-h-64 w-36 shrink-0 snap-start flex-col items-center justify-center gap-4 border border-dashed text-xs focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-44"
                >
                    <Plus size={28} strokeWidth={1} aria-hidden="true" />
                    add day
                </button>
            </div>
            <p className="text-muted-foreground mt-2 max-w-xl text-[11px] leading-relaxed">
                Drag activities to change day and time in 30-minute steps. Use an activity’s move menu to change its
                position without changing its time. Each day scrolls independently.
            </p>
            <p role="status" className="sr-only">
                {announcement}
            </p>
            {dialogDay ? (
                <AddPinDialog
                    day={dialogDay}
                    days={days}
                    onAdd={(dayId, pin, image) => onAddPin(dayId, pin, image)}
                    onClose={() => setDialogDayId(null)}
                    onEditExisting={openExistingPin}
                />
            ) : null}
            {editingPin ? (
                <PinEditorDialog
                    pin={editingPin}
                    images={images}
                    remainingUploads={10 - images.filter((image) => image.source === "upload").length}
                    onClose={() => setEditingPinId(null)}
                    onSave={onUpdatePin}
                    onDelete={() => {
                        onRemovePin(editingPin.id);
                        setEditingPinId(null);
                    }}
                    onAddImage={onAddActivityImage}
                    onAssignImage={onAssignActivityImage}
                    onSetCover={onSetActivityCover}
                    onReorderImage={onReorderActivityImage}
                />
            ) : null}
            {removingDay ? (
                <ConfirmDialog
                    title={`Remove day ${removingDay.dayNumber}?`}
                    description={`This will remove the day and its ${removingDay.pins.length} pin${removingDay.pins.length === 1 ? "" : "s"}. This cannot be undone inside this editor.`}
                    confirmLabel="Remove day and pins"
                    onCancel={() => setRemovingDayId(null)}
                    onConfirm={() => {
                        onRemoveDay(removingDay.id);
                        setRemovingDayId(null);
                    }}
                />
            ) : null}
        </fieldset>
    );
}
