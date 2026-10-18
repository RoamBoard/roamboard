/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
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
    onClose
}: {
    images: BoardImageDraft[];
    coverImageId: number | null;
    onSelect: (id: number) => void;
    onUpload: () => void;
    onClose: () => void;
}) {
    const dialog = useRef<HTMLDivElement>(null);
    const [editing, setEditing] = useState<number | null>(null);
    const photoUrl = usePhotoUrls();
    useDialogFocus(dialog, onClose, editing === null);
    const uploads = images.filter((image) => image.source === "upload" && image.uploadedImageId);
    const cover = uploads.find((image) => image.uploadedImageId === coverImageId);
    return (
        <>
            <div
                inert={editing !== null}
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
                            <img
                                src={photoUrl(cover.url)}
                                alt="Selected Board cover"
                                decoding="async"
                                className="aspect-[2.42] w-full rounded-b-[50%_100%] object-cover"
                            />
                            <button
                                type="button"
                                onClick={() => setEditing(cover.uploadedImageId!)}
                                className="mt-4 min-h-11 text-sm underline underline-offset-4"
                            >
                                Crop / resize cover
                            </button>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm">Choose a photo for your Board cover.</p>
                    )}
                    {uploads.length ? (
                        <BoardPhotoStrip label="Board cover photos">
                            {uploads.map((image, index) => (
                                <li key={image.id} className="w-28 shrink-0 snap-start">
                                    <button
                                        type="button"
                                        aria-label={`Use photo ${index + 1} as Board cover`}
                                        aria-pressed={image.uploadedImageId === coverImageId}
                                        onClick={() => onSelect(image.uploadedImageId!)}
                                        className="aria-pressed:outline-foreground w-full outline-offset-2 aria-pressed:outline-2"
                                    >
                                        <img
                                            src={photoUrl(image.thumbnailUrl)}
                                            loading="lazy"
                                            decoding="async"
                                            width={112}
                                            height={112}
                                            alt={`Board photo ${index + 1}`}
                                            className="aspect-square w-full object-cover"
                                        />
                                        <span className="mt-2 block text-xs">
                                            {image.uploadedImageId === coverImageId ? "Board cover" : "Use as cover"}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </BoardPhotoStrip>
                    ) : null}
                    <button type="button" onClick={onUpload} className="border-line mt-6 min-h-11 border px-5 text-sm">
                        Upload another photo
                    </button>
                </div>
            </div>
            {editing !== null ? <PhotoEditorDialog imageId={editing} onClose={() => setEditing(null)} /> : null}
        </>
    );
}
