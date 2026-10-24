/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import EditorPhotoGallery from "./EditorPhotoGallery";
import { Crop, Trash2, Upload, X } from "lucide-react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { usePhotoUrls } from "@/lib/use-photo-urls";
import PhotoEditorDialog from "@/components/images/PhotoEditorDialog";
import BoardPhotoStrip from "./BoardPhotoStrip";
import type { BoardImageDraft } from "@/types/board-creator";

export default function BoardCoverDialog({
    images,
    coverImageId,
    onSelect,
    onUpload,
    onClose,
    onRemove
}: {
    images: BoardImageDraft[];
    coverImageId: number | null;
    onSelect: (id: number) => void;
    onUpload: () => void;
    onClose: () => void;
    onRemove?: (id: string) => void;
}) {
    const dialog = useRef<HTMLDivElement>(null);
    const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
    const [editing, setEditing] = useState<number | null>(null);
    const photoUrl = usePhotoUrls();
    useDialogFocus(dialog, onClose, editing === null && galleryIndex === null);
    const uploads = images.filter((image) => image.source === "upload" && image.uploadedImageId);
    const cover = uploads.find((image) => image.uploadedImageId === coverImageId);
    return (
        <>
            {galleryIndex !== null ? (
                <EditorPhotoGallery images={uploads} index={galleryIndex} onClose={() => setGalleryIndex(null)} />
            ) : null}
            <div
                inert={editing !== null || galleryIndex !== null}
                className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4"
                onClick={(event) => {
                    if (event.target === event.currentTarget && editing === null) onClose();
                }}
            >
                <div
                    ref={dialog}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="board-cover-heading"
                    tabIndex={-1}
                    className="bg-background text-foreground relative my-auto max-h-[90dvh] w-full max-w-3xl overflow-y-auto p-6 sm:p-8"
                >
                    <header className="mb-6 flex items-center justify-between gap-4">
                        <h2 id="board-cover-heading" className="font-display text-30 font-bold">
                            Board cover
                        </h2>
                        <button
                            type="button"
                            aria-label="Close Board cover"
                            onClick={onClose}
                            className="grid size-11 place-items-center"
                        >
                            <X size={20} />
                        </button>
                    </header>
                    {cover ? (
                        <div>
                            <button
                                type="button"
                                className="block w-full"
                                aria-label="Enlarge Board cover"
                                onClick={() => setGalleryIndex(uploads.indexOf(cover))}
                            >
                                <img
                                    src={photoUrl(cover.url)}
                                    alt="Selected Board cover"
                                    decoding="async"
                                    className="aspect-[4/3] w-full rounded-2xl object-cover"
                                />
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditing(cover.uploadedImageId!)}
                                className="group/action mt-4 inline-flex min-h-11 items-center gap-3 text-sm"
                            >
                                <Crop
                                    size={18}
                                    className="transition-transform group-hover/action:scale-110 motion-reduce:transition-none"
                                />{" "}
                                Crop cover
                            </button>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm">Choose a photo for your Board cover.</p>
                    )}
                    {uploads.length ? (
                        <BoardPhotoStrip label="Board cover photos">
                            {uploads.map((image, index) => (
                                <li key={image.id} className="group/photo relative w-48 min-w-0 shrink-0">
                                    <button
                                        type="button"
                                        aria-label={`Enlarge Board photo ${index + 1}`}
                                        onClick={() => setGalleryIndex(index)}
                                        className="block w-full overflow-hidden rounded-2xl focus-visible:outline-2"
                                    >
                                        <img
                                            src={photoUrl(image.thumbnailUrl)}
                                            loading="lazy"
                                            decoding="async"
                                            width={192}
                                            height={192}
                                            alt={`Board photo ${index + 1}`}
                                            draggable={false}
                                            className="aspect-square w-full object-cover transition-transform duration-300 group-hover/photo:scale-[1.03] motion-reduce:transition-none"
                                        />
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={`Use photo ${index + 1} as Board cover`}
                                        aria-pressed={image.uploadedImageId === coverImageId}
                                        onClick={() => onSelect(image.uploadedImageId!)}
                                        className="mt-2 min-h-11 text-xs underline underline-offset-4"
                                    >
                                        {image.uploadedImageId === coverImageId ? "Board cover" : "Use as cover"}
                                    </button>
                                    <div className="editor-photo-actions">
                                        <button
                                            type="button"
                                            aria-label={`Crop photo ${index + 1}`}
                                            title="Crop"
                                            onClick={() => setEditing(image.uploadedImageId!)}
                                            className="editor-icon-action"
                                        >
                                            <Crop size={16} />
                                        </button>
                                        {onRemove ? (
                                            <button
                                                type="button"
                                                aria-label={`Delete photo ${index + 1}`}
                                                title="Remove from Board"
                                                onClick={() => onRemove(image.id)}
                                                className="editor-icon-action"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        ) : null}
                                    </div>
                                </li>
                            ))}
                        </BoardPhotoStrip>
                    ) : null}
                    <button
                        type="button"
                        onClick={onUpload}
                        className="group/action mt-6 inline-flex min-h-11 items-center gap-3 text-sm"
                    >
                        <Upload
                            size={20}
                            className="border-line size-10 rounded-full border p-2 transition-transform group-hover/action:scale-110 motion-reduce:transition-none"
                        />{" "}
                        Add photos
                    </button>
                </div>
            </div>
            {editing !== null ? <PhotoEditorDialog imageId={editing} onClose={() => setEditing(null)} /> : null}
        </>
    );
}
