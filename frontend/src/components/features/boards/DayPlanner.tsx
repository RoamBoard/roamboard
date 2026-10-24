"use client";

import { useState } from "react";

import BoardPhotoStrip from "./BoardPhotoStrip";
import AddActivityDialog from "./AddActivityDialog";
import ActivityEditorDialog from "./ActivityEditorDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

import PlannerDayColumn from "@/components/features/boards/PlannerDayColumn";
import { Plus } from "lucide-react";
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
    onDayColorChange: (dayId: string, color: string) => void;
    onRemoveDay: (dayId: string) => void;
    onAddPin: (dayId: string, pin: BoardPinDraft, image: BoardImageDraft | null) => void;
    onUpdatePin: (pin: BoardPinDraft) => void;
    onMovePin: (pinId: string, dayId: string, time: string, index?: number) => void;
    onRemovePin: (pinId: string) => void;
    onRemoveActivityImage?: (id: string) => void;
    onAddActivityImage: (image: BoardImageDraft) => void;
    onAssignActivityImage: (imageId: string, pinId: string | null) => void;
    onSetActivityCover: (pinId: string, imageId: number | null) => void;
    onReorderActivityImage: (pinId: string, imageId: string, direction: -1 | 1) => void;
};

export default function DayPlanner({
    destination,
    disabled = false,
    openActivityId,
    onActivityOpened,
    onActivityUploadingChange,
    days,
    images,
    onAddDay,
    onDayColorChange,
    onRemoveDay,
    onAddPin,
    onUpdatePin,
    onMovePin,
    onRemovePin,
    onRemoveActivityImage,
    onAddActivityImage,
    onAssignActivityImage,
    onSetActivityCover,
    onReorderActivityImage
}: Props) {
    const [dialogDayId, setDialogDayId] = useState<string | null>(null);
    const [editingPinId, setEditingPinId] = useState<string | null>(null);
    const [removingDayId, setRemovingDayId] = useState<string | null>(null);
    const [announcement, setAnnouncement] = useState("");
    const [dragTarget, setDragTarget] = useState<{ dayId: string; index: number } | null>(null);
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
            </div>
            <BoardPhotoStrip label="Board day plans" days>
                {days.map((day, dayIndex) => (
                    <PlannerDayColumn
                        key={day.id}
                        day={day}
                        dayIndex={dayIndex}
                        dragTarget={dragTarget}
                        onDragTargetChange={setDragTarget}
                        onColorChange={(color) => onDayColorChange(day.id, color)}
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
                <li className="w-full shrink-0 sm:w-32 md:w-28">
                    <button
                        type="button"
                        disabled={disabled || days.length >= 31}
                        onClick={onAddDay}
                        className="border-line text-muted-foreground hover:border-foreground hover:text-foreground mt-0 flex h-full min-h-32 w-full flex-col items-center justify-center gap-4 border border-dashed text-xs focus-visible:outline-2 focus-visible:outline-offset-2 md:min-h-64"
                    >
                        <Plus size={28} strokeWidth={1} aria-hidden="true" />
                        {days.length >= 31 ? "31-day maximum" : "add day"}
                    </button>
                </li>
            </BoardPhotoStrip>
            <p id="activity-drag-hint" className="text-muted-foreground mt-2 max-w-xl text-[11px] leading-relaxed">
                Drag the grip on an activity to move it within a day or to another day. Use the arrow keys on a focused
                activity to reorder; Shift + arrow moves between days. Drag empty space or use the arrows to browse
                days.
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
