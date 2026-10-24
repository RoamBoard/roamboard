"use client";
import { useState } from "react";
import ActivityEditorDialog from "./ActivityEditorDialog";
import type { BoardDayDraft, BoardImageDraft, BoardPinDraft } from "@/types/board-creator";
type Props = {
    day: BoardDayDraft;
    onClose: () => void;
    onAdd: (dayId: string, activity: BoardPinDraft, image: BoardImageDraft | null) => void;
    proximity?: { latitude: number; longitude: number } | null;
    images?: BoardImageDraft[];
    onAddImage?: (image: BoardImageDraft) => void;
    onAssignImage?: (imageId: string, pinId: string | null) => void;
    onRemoveImage?: (id: string) => void;
    onUploadingChange?: (busy: boolean) => void;
};
export default function AddActivityDialog({
    day,
    onClose,
    onAdd,
    proximity,
    images = [],
    onAddImage,
    onAssignImage,
    onRemoveImage,
    onUploadingChange
}: Props) {
    const [activity] = useState<BoardPinDraft>(() => ({
        id: crypto.randomUUID(),
        order: day.pins.length,
        time: "",
        title: "",
        description: "",
        category: "activity",
        source: "manual",
        location: null
    }));
    return (
        <ActivityEditorDialog
            mode="create"
            dayNumber={day.dayNumber}
            pin={activity}
            proximity={proximity}
            images={images}
            remainingUploads={5}
            onClose={onClose}
            onUploadingChange={onUploadingChange}
            onDelete={() => {}}
            onSave={(pin) => onAdd(day.id, pin, null)}
            onAddImage={(image) => onAddImage?.(image)}
            onAssignImage={(id, pinId) => onAssignImage?.(id, pinId)}
            onRemoveImage={onRemoveImage}
            onSetCover={() => {}}
            onReorderImage={() => {}}
        />
    );
}
