"use client";

import { useRef, useState } from "react";

import AddActivityDialog from "./AddActivityDialog";
import ActivityEditorDialog from "./ActivityEditorDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

import PlannerDayColumn from "@/components/features/boards/PlannerDayColumn";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { type BoardDayDraft, type BoardImageDraft, type BoardPinDraft } from "@/types/board-creator";

type Props = {
    destination?: { latitude: number; longitude: number } | null;
    disabled?: boolean;
    openActivityId?: string | null;
    onActivityOpened?: () => void;
    onActivityUploadingChange?: (uploading: boolean) => void;
    days: BoardDayDraft[];
    images: BoardImageDraft[];
    onAddDay: () => void;
    onRemoveDay: (dayId: string) => void;
    onAddPin: (dayId: string, pin: BoardPinDraft, image: BoardImageDraft | null) => void;
    onUpdatePin: (pin: BoardPinDraft) => void;
    onMovePin: (pinId: string, dayId: string, time: string, index?: number) => void;
    onReorderPin: (pinId: string, direction: -1 | 1) => void;
    onRemovePin: (pinId: string) => void;
    onRemoveActivityImage?: (id: string) => void;
    onAddActivityImage: (image: BoardImageDraft) => void;
    onImageMetadataChange?: (
        imageId: number,
        metadata: { capturedAt: string | null; latitude: number | null; longitude: number | null }
    ) => void;
    onAssignActivityImage: (imageId: string, pinId: string | null) => void;
    onSetActivityCover: (pinId: string, imageId: number | null) => void;
    onReorderActivityImage: (pinId: string, imageId: string, direction: -1 | 1) => void;
};

function scrollBehavior(): ScrollBehavior {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export default function DayPlanner({
    destination,
    disabled = false,
    openActivityId,
    onActivityOpened,
    onActivityUploadingChange,
    days,
    images,
    onAddDay,
    onRemoveDay,
    onAddPin,
    onUpdatePin,
    onMovePin,
    onReorderPin,
    onRemovePin,
    onRemoveActivityImage,
    onAddActivityImage,
    onImageMetadataChange,
    onAssignActivityImage,
    onSetActivityCover,
    onReorderActivityImage
}: Props) {
    const stripRef = useRef<HTMLDivElement>(null);
    const [dialogDayId, setDialogDayId] = useState<string | null>(null);
    const [editingPinId, setEditingPinId] = useState<string | null>(null);
    const [removingDayId, setRemovingDayId] = useState<string | null>(null);
    const [announcement, setAnnouncement] = useState("");
    const dialogDay = openActivityId ? null : (days.find((day) => day.id === dialogDayId) ?? null);
    const editingPin =
        days.flatMap((day) => day.pins).find((pin) => pin.id === (openActivityId ?? editingPinId)) ?? null;
    const boardLocation =
        days.flatMap((day) => day.pins).find((activity) => activity.location)?.location ?? destination;
    const removingDay = days.find((day) => day.id === removingDayId) ?? null;

    function requestRemoveDay(day: BoardDayDraft) {
        if (disabled || days.length === 1) return;
        if (day.pins.length === 0) onRemoveDay(day.id);
        else setRemovingDayId(day.id);
    }

    function openExistingPin(pinId: string) {
        if (disabled) return;
        setDialogDayId(null);
        onActivityOpened?.();
        setEditingPinId(pinId);
    }

    function announceMove(pinId: string, text: string) {
        setAnnouncement(text);
        requestAnimationFrame(() => {
            document.getElementById(`activity-${pinId}`)?.focus();
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
                <div className="hidden gap-1 md:flex">
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
                className="flex flex-col items-stretch gap-7 pb-6 md:snap-x md:snap-proximity md:flex-row md:gap-10 md:overflow-x-auto md:overscroll-x-contain"
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
                        onMovePin={(pinId, dayId, time, index) => {
                            if (disabled) return;
                            onMovePin(pinId, dayId, time, index);
                            const target = days.find((item) => item.id === dayId);
                            announceMove(
                                pinId,
                                `Activity moved to day ${target?.dayNumber ?? ""} at ${time || "an open time"}.`
                            );
                        }}
                    />
                ))}
                <button
                    type="button"
                    disabled={disabled || days.length >= 31}
                    onClick={onAddDay}
                    className="border-line text-muted-foreground hover:border-foreground hover:text-foreground mt-0 flex min-h-32 w-full shrink-0 snap-start flex-col items-center justify-center gap-4 border border-dashed text-xs focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-32 md:min-h-64 md:w-28"
                >
                    <Plus size={28} strokeWidth={1} aria-hidden="true" />
                    {days.length >= 31 ? "31-day maximum" : "add day"}
                </button>
            </div>
            <p className="text-muted-foreground mt-2 max-w-xl text-[11px] leading-relaxed">
                Drag activities to change day and time in 30-minute steps. Open an activity to change its day or order
                without changing its time. Scroll the page to browse activities; swipe sideways or Shift-scroll to
                browse days.
            </p>
            <p role="status" className="sr-only">
                {announcement}
            </p>

            {dialogDay ? (
                <AddActivityDialog
                    onRemoveImage={onRemoveActivityImage}
                    images={images}
                    onAddImage={onAddActivityImage}
                    onAssignImage={onAssignActivityImage}
                    onUploadingChange={onActivityUploadingChange}
                    proximity={dialogDay.pins.find((activity) => activity.location)?.location ?? boardLocation}
                    day={dialogDay}
                    onAdd={(dayId, pin, image) => {
                        onAddPin(dayId, pin, image);
                        setAnnouncement(`${pin.title} added to the day plan.`);
                    }}
                    onClose={() => setDialogDayId(null)}
                />
            ) : null}
            {editingPin ? (
                <ActivityEditorDialog
                    placement={{
                        days,
                        dayId: days.find((day) => day.pins.some((pin) => pin.id === editingPin.id))!.id,
                        onMove: (dayId) => {
                            const target = days.find((day) => day.id === dayId);
                            if (target) onMovePin(editingPin.id, dayId, editingPin.time, target.pins.length);
                        },
                        onReorder: (direction) => onReorderPin(editingPin.id, direction)
                    }}
                    proximity={editingPin.location ?? boardLocation}
                    pin={editingPin}
                    onUploadingChange={onActivityUploadingChange}
                    onRemoveImage={onRemoveActivityImage}
                    images={images}
                    remainingUploads={5}
                    onClose={() => {
                        setEditingPinId(null);
                        onActivityOpened?.();
                    }}
                    onSave={(updated) => {
                        onUpdatePin(updated);
                    }}
                    onDelete={() => {
                        onRemovePin(editingPin.id);
                        onActivityOpened?.();
                        setAnnouncement(`${editingPin.title} removed. Attached photos remain available.`);
                        setEditingPinId(null);
                    }}
                    onMetadataChange={onImageMetadataChange}
                    onAddImage={onAddActivityImage}
                    onAssignImage={onAssignActivityImage}
                    onSetCover={onSetActivityCover}
                    onReorderImage={onReorderActivityImage}
                />
            ) : null}
            {removingDay ? (
                <ConfirmDialog
                    title={`Remove day ${removingDay.dayNumber}?`}
                    description={`This will remove the day and its ${removingDay.pins.length} activit${removingDay.pins.length === 1 ? "y" : "ies"}. This cannot be undone inside this editor.`}
                    confirmLabel="Remove day and activities"
                    onCancel={() => setRemovingDayId(null)}
                    onConfirm={() => {
                        onRemoveDay(removingDay.id);
                        setAnnouncement(`Day ${removingDay.dayNumber} removed. Attached photos remain available.`);
                        setRemovingDayId(null);
                    }}
                />
            ) : null}
        </fieldset>
    );
}
