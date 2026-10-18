"use client";
import { useRef, useState } from "react";
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
    onUploadingChange
}: Props) {
    const [activity] = useState<BoardPinDraft>(() => ({
        id: crypto.randomUUID(),
        order: day.pins.length,
        time: "",
        title: "",
        description: "",
        category: "activity",
        source: "geoapify",
        location: null
    }));
    const [media, setMedia] = useState(images);
    const mediaRef = useRef(media);
    function updateMedia(next: BoardImageDraft[]) {
        mediaRef.current = next;
        setMedia(next);
    }
    return (
        <ActivityEditorDialog
            mode="create"
            dayNumber={day.dayNumber}
            pin={activity}
            proximity={proximity}
            images={media}
            remainingUploads={30}
            onClose={onClose}
            onUploadingChange={onUploadingChange}
            onDelete={() => {}}
            onSave={(draft) => {
                onAdd(day.id, draft, null);
                mediaRef.current
                    .filter((image) => image.pinId === activity.id)
                    .sort(
                        (first, second) => (first.activityOrder ?? first.order) - (second.activityOrder ?? second.order)
                    )
                    .forEach((image) => onAssignImage?.(image.id, activity.id));
            }}
            onAddImage={(image) => {
                updateMedia([...mediaRef.current, image]);
                onAddImage?.({ ...image, pinId: null });
            }}
            onAssignImage={(id, pinId) =>
                updateMedia(mediaRef.current.map((image) => (image.id === id ? { ...image, pinId } : image)))
            }
            onSetCover={() => {}}
            onReorderImage={(_pinId, id, direction) => {
                const attached = mediaRef.current
                    .filter((image) => image.pinId === activity.id)
                    .sort((a, b) => (a.activityOrder ?? a.order) - (b.activityOrder ?? b.order));
                const index = attached.findIndex((image) => image.id === id),
                    target = index + direction;
                if (index < 0 || target < 0 || target >= attached.length) return;
                const reordered = [...attached];
                [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
                updateMedia(
                    mediaRef.current.map((image) => {
                        const position = reordered.findIndex((item) => item.id === image.id);
                        return position < 0 ? image : { ...image, activityOrder: position };
                    })
                );
            }}
        />
    );
}
