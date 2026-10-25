"use client";
import { useState } from "react";
import { Crop, Trash2 } from "lucide-react";
import { dayColor } from "@/lib/day-color";
import { usePhotoUrls } from "@/lib/use-photo-urls";
import { createBoardPreview } from "@/lib/board-creation-preview";
import type { BoardCreatorPayload, BoardImageDraft } from "@/types/board-creator";
import PhotoEditorDialog from "@/components/images/PhotoEditorDialog";
import CroppedPhoto from "@/components/images/CroppedPhoto";
import EditorPhotoGallery, { editorPhoto } from "./EditorPhotoGallery";
import { StoryPhotoCredit } from "./StoryPhoto";

import BoardPreviewDiagram from "./BoardPreviewDiagram";

export type PreviewPhotoActions = {
    onRemovePhoto?: (id: string) => void;
    onUpdatePhoto?: (image: BoardImageDraft) => void;
    onEditActivity?: (id: string) => void;
};
type Props = PreviewPhotoActions & { board: BoardCreatorPayload; author?: string; editable?: boolean };
const editLink =
    "text-muted-foreground hover:text-foreground mt-2 inline-flex min-h-11 items-center text-[11px] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4";
export default function BoardCreationPreview({
    board: sourceBoard,
    author,
    editable = true,
    onRemovePhoto,
    onUpdatePhoto,
    onEditActivity
}: Props) {
    const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
    const [editing, setEditing] = useState<BoardImageDraft | null>(null);
    const photoUrl = usePhotoUrls();
    const board = {
        ...sourceBoard,
        images: sourceBoard.images.map((image) => ({
            ...image,
            url: photoUrl(image.url),
            thumbnailUrl: photoUrl(image.thumbnailUrl)
        }))
    };
    const preview = createBoardPreview(board, author);
    const pins = board.days.flatMap((day) => day.pins);
    const uploads = board.images.filter((image) => image.source === "upload");
    const other = board.images.filter((image) => !image.pinId);
    const byActivity = new Map<string, BoardImageDraft[]>();
    const activityTitles = new Map(pins.map((pin) => [pin.id, pin.title]));
    const imageIndices = new Map(board.images.map((image, index) => [image.id, index]));
    for (const image of board.images) {
        if (!image.pinId) continue;
        const group = byActivity.get(image.pinId) ?? [];
        group.push(image);
        byActivity.set(image.pinId, group);
    }
    for (const group of byActivity.values())
        group.sort((a, b) => (a.activityOrder ?? a.order) - (b.activityOrder ?? b.order));
    function photoCard(image: BoardImageDraft, index: number) {
        return (
            <li key={image.id} className="group/photo relative min-w-0">
                <figure>
                    <button
                        type="button"
                        className="editor-photo-card block w-full overflow-hidden rounded-2xl focus-visible:outline-2"
                        aria-label={`Enlarge Board photo ${index + 1}`}
                        aria-describedby={image.pinId ? `review-photo-${image.id}` : undefined}
                        onClick={() => setGalleryIndex(imageIndices.get(image.id) ?? 0)}
                    >
                        <CroppedPhoto
                            thumbnail
                            src={image.thumbnailUrl}
                            alt={image.alt ?? "Board photo"}
                            presentation={image.presentation}
                            width={image.width}
                            height={image.height}
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                            className="aspect-square w-full object-cover"
                        />
                    </button>
                    {image.pinId ? (
                        <span
                            id={`review-photo-${image.id}`}
                            className="editor-photo-label pointer-events-none absolute inset-x-2 bottom-14 rounded-lg bg-black/75 px-2 py-1 text-xs text-white"
                        >
                            {activityTitles.get(image.pinId)}
                        </span>
                    ) : null}
                    {editable && onRemovePhoto ? (
                        <div className="editor-photo-actions">
                            <button
                                type="button"
                                aria-label={`Crop photo ${index + 1}`}
                                title="Crop"
                                className="editor-icon-action"
                                onClick={() => setEditing(image)}
                            >
                                <Crop size={16} />
                            </button>
                            <button
                                type="button"
                                aria-label={
                                    image.pinId
                                        ? `Remove photo ${index + 1} from activity`
                                        : `Delete photo ${index + 1} from Board`
                                }
                                title={image.pinId ? "Remove from activity" : "Delete from Board"}
                                className="editor-icon-action"
                                onClick={() => onRemovePhoto(image.id)}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ) : null}
                    <StoryPhotoCredit image={editorPhoto(image)} />
                    {image.uploadedImageId === board.coverImageId ? (
                        <p className="text-muted-foreground mt-2 text-[10px]">Selected Board cover</p>
                    ) : null}
                </figure>
            </li>
        );
    }
    return (
        <article aria-label="Board preview" className="@container min-w-0">
            {galleryIndex !== null ? (
                <EditorPhotoGallery images={board.images} index={galleryIndex} onClose={() => setGalleryIndex(null)} />
            ) : null}
            {editing ? (
                editing.source === "upload" ? (
                    <PhotoEditorDialog imageId={editing.uploadedImageId} onClose={() => setEditing(null)} />
                ) : (
                    <PhotoEditorDialog
                        external={editing}
                        onSaveExternal={(presentation) => {
                            const original = sourceBoard.images.find((image) => image.id === editing.id);
                            if (original) onUpdatePhoto?.({ ...original, presentation });
                        }}
                        onClose={() => setEditing(null)}
                    />
                )
            ) : null}
            <BoardPreviewDiagram preview={preview} editable={editable} mainDestination={Boolean(board.destination)} />
            <div className="text-muted-foreground mt-10 flex flex-wrap justify-between gap-x-6 gap-y-2 text-[11px]">
                <p>Live preview · updates as you edit</p>
                <p>
                    {board.days.length} {board.days.length === 1 ? "day" : "days"} · {pins.length}{" "}
                    {pins.length === 1 ? "activity" : "activities"} · {uploads.length} uploaded{" "}
                    {uploads.length === 1 ? "photo" : "photos"}
                </p>
            </div>
            <details open className="border-line mt-8 border-t pt-3">
                <summary className="text-foreground cursor-pointer py-4 text-sm font-medium focus-visible:outline-2">
                    Review full Board · {pins.length} {pins.length === 1 ? "activity" : "activities"}
                </summary>
                <div className="mt-4 space-y-8">
                    {board.days.map((day, index) => (
                        <section
                            key={day.id}
                            className="editor-review-day min-w-0 rounded-2xl border-l-4 py-3 pl-4 sm:pl-6"
                            style={{ borderColor: dayColor(day, index) }}
                        >
                            <header className="mb-4 flex flex-wrap items-baseline gap-3">
                                <h3 className="font-display text-xl font-bold">Day {day.dayNumber}</h3>
                                {day.date ? <time className="text-muted-foreground text-xs">{day.date}</time> : null}
                            </header>
                            <ul
                                aria-label={`Day ${day.dayNumber} photos`}
                                className="mb-5 grid grid-cols-2 gap-4 @xl:grid-cols-4 @4xl:grid-cols-6"
                            >
                                {day.pins.flatMap((pin) => byActivity.get(pin.id) ?? []).map(photoCard)}
                            </ul>
                            <ol className="space-y-3">
                                {day.pins.map((pin) => (
                                    <li key={pin.id} className="min-w-0">
                                        <div className="flex items-baseline gap-3">
                                            {pin.time ? (
                                                <time className="text-muted-foreground text-xs tabular-nums">
                                                    {pin.time}
                                                </time>
                                            ) : null}
                                            {editable && onEditActivity ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onEditActivity(pin.id)}
                                                    className="text-left text-sm font-medium underline-offset-4 hover:underline"
                                                >
                                                    {pin.title}
                                                </button>
                                            ) : (
                                                <h4 className="text-sm font-medium">{pin.title}</h4>
                                            )}
                                        </div>
                                        {pin.location ? (
                                            <p className="text-muted-foreground mt-1 text-xs">{pin.location.name}</p>
                                        ) : null}
                                        {pin.description ? (
                                            <p className="text-muted-foreground mt-2 max-w-3xl text-xs leading-relaxed whitespace-pre-wrap">
                                                {pin.description}
                                            </p>
                                        ) : null}
                                    </li>
                                ))}
                            </ol>
                            {!day.pins.length ? (
                                <p className="text-muted-foreground text-xs">No activities yet</p>
                            ) : null}
                        </section>
                    ))}
                </div>
                {!board.days.length ? <p className="text-muted-foreground text-xs">No days added yet.</p> : null}
                {other.length ? (
                    <section aria-label="Other Board photos" className="mt-8">
                        <h3 className="text-sm font-medium">Other Board photos</h3>
                        <ul className="mt-4 grid grid-cols-2 gap-4 @xl:grid-cols-4 @4xl:grid-cols-6">
                            {other.map(photoCard)}
                        </ul>
                    </section>
                ) : null}
                {!board.images.length ? (
                    <p className="text-muted-foreground mt-5 text-xs">No photos added yet.</p>
                ) : null}
                {editable ? (
                    <a href="#day-plan" className={editLink}>
                        Back to day plan
                    </a>
                ) : null}
            </details>
        </article>
    );
}
