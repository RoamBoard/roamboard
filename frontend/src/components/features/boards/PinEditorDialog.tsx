/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";

import PinCategoryIcon from "@/components/ui/PinCategoryIcon";
import { pinCategories } from "@/lib/board-options";
import { uploadBoardImage } from "@/lib/board-creator-api";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import type { BoardImageDraft, BoardPinDraft, PinCategory } from "@/types/board-creator";

type Props = {
    pin: BoardPinDraft;
    images: BoardImageDraft[];
    remainingUploads: number;
    onClose: () => void;
    onSave: (pin: BoardPinDraft) => void;
    onDelete: () => void;
    onAddImage: (image: BoardImageDraft) => void;
    onAssignImage: (imageId: string, pinId: string | null) => void;
    onSetCover: (pinId: string, imageId: number | null) => void;
    onReorderImage: (pinId: string, imageId: string, direction: -1 | 1) => void;
};

export default function PinEditorDialog({
    pin,
    images,
    remainingUploads,
    onClose,
    onSave,
    onDelete,
    onAddImage,
    onAssignImage,
    onSetCover,
    onReorderImage
}: Props) {
    const dialogRef = useRef<HTMLDivElement>(null);
    useDialogFocus(dialogRef, onClose);
    const inputRef = useRef<HTMLInputElement>(null);
    const [draft, setDraft] = useState(pin);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    const activityImages = images
        .filter((image) => image.pinId === pin.id)
        .sort((first, second) => (first.activityOrder ?? first.order) - (second.activityOrder ?? second.order));
    const availableImages = images.filter((image) => image.source === "upload" && image.pinId !== pin.id);
    const cover =
        draft.coverImageId === null
            ? (activityImages.find((image) => image.source === "unsplash") ?? null)
            : (activityImages.find((image) => image.uploadedImageId === draft.coverImageId) ?? activityImages[0]);

    async function upload(files: File[]) {
        if (files.length === 0) return;
        if (files.length > remainingUploads) {
            setError(
                `You can upload ${remainingUploads} more image${remainingUploads === 1 ? "" : "s"} to this Board.`
            );
            return;
        }
        setUploading(true);
        setError("");
        try {
            for (const file of files) {
                const asset = await uploadBoardImage(file);
                onAddImage({
                    id: crypto.randomUUID(),
                    uploadedImageId: asset.imageId,
                    pinId: pin.id,
                    publicId: String(asset.imageId),
                    source: "upload",
                    url: asset.url,
                    thumbnailUrl: asset.thumbnailUrl,
                    width: 0,
                    height: 0,
                    capturedAt: asset.capturedAt,
                    latitude: asset.latitude,
                    longitude: asset.longitude,
                    order: 0,
                    credit: null,
                    creditUrl: null,
                    sourceUrl: null
                });
            }
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "The activity images could not be uploaded.");
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                ref={dialogRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-pin-heading"
                className="bg-background max-h-[92dvh] w-full max-w-xl overflow-y-auto p-6 shadow-2xl outline-none sm:p-8"
            >
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-10 tracking-label text-stone font-bold uppercase">Edit itinerary pin</p>
                        <h2 id="edit-pin-heading" className="font-display text-30 mt-2 font-bold">
                            {pin.title}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="border-line text-22 grid size-10 place-items-center border"
                        aria-label="Close pin editor"
                    >
                        ×
                    </button>
                </div>
                {cover ? (
                    <figure className="mt-6">
                        <img
                            src={cover.url}
                            onError={() => setError("The activity image could not load.")}
                            alt={`Image for ${pin.title}`}
                            className="aspect-video w-full object-cover"
                        />
                        {cover.credit && cover.creditUrl && cover.sourceUrl ? (
                            <figcaption className="text-10 text-stone mt-1">
                                Photo by{" "}
                                <a href={cover.creditUrl} target="_blank" rel="noreferrer" className="underline">
                                    {cover.credit}
                                </a>{" "}
                                on{" "}
                                <a href={cover.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                                    Unsplash
                                </a>
                            </figcaption>
                        ) : null}
                    </figure>
                ) : null}
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*,.heic,.heif"
                    multiple
                    className="sr-only"
                    onChange={(event) => void upload(Array.from(event.target.files ?? []))}
                />
                <button
                    type="button"
                    disabled={uploading || remainingUploads === 0}
                    onClick={() => inputRef.current?.click()}
                    className="border-foreground text-12 mt-3 border-b pb-1 disabled:opacity-40"
                >
                    {uploading ? "Uploading..." : "Upload activity images"}
                </button>
                <section className="mt-5" aria-label="Activity images">
                    <h3 className="text-12 font-bold">Activity images</h3>
                    {activityImages.length === 0 ? (
                        <p className="text-12 text-graphite mt-2">No images attached yet.</p>
                    ) : null}
                    <ul className="mt-3 grid grid-cols-2 gap-3">
                        {activityImages.map((item, index) => (
                            <li key={item.id} className="border-line border p-2">
                                <img
                                    src={item.thumbnailUrl}
                                    alt={`${pin.title} image ${index + 1}`}
                                    className="aspect-square w-full object-cover"
                                />
                                {item.id === cover?.id ? (
                                    <span className="text-10 mt-2 block font-bold">Activity cover</span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const nextCoverId = item.uploadedImageId ?? null;
                                            onSetCover(pin.id, nextCoverId);
                                            setDraft((current) => ({
                                                ...current,
                                                coverImageId: nextCoverId
                                            }));
                                        }}
                                        className="text-10 mt-2 underline"
                                    >
                                        Set as activity cover
                                    </button>
                                )}
                                {item.source === "upload" ? (
                                    <div className="text-10 mt-2 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            disabled={index === 0}
                                            onClick={() => onReorderImage(pin.id, item.id, -1)}
                                            aria-label={`Move image ${index + 1} earlier`}
                                            className="underline disabled:opacity-40"
                                        >
                                            Earlier
                                        </button>
                                        <button
                                            type="button"
                                            disabled={index === activityImages.length - 1}
                                            onClick={() => onReorderImage(pin.id, item.id, 1)}
                                            aria-label={`Move image ${index + 1} later`}
                                            className="underline disabled:opacity-40"
                                        >
                                            Later
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onAssignImage(item.id, null)}
                                            className="underline"
                                        >
                                            Detach
                                        </button>
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </section>
                {availableImages.length > 0 ? (
                    <section className="mt-5" aria-label="Other uploaded images">
                        <h3 className="text-12 font-bold">Attach a Board upload</h3>
                        <ul className="mt-3 flex gap-3 overflow-x-auto">
                            {availableImages.map((item) => (
                                <li key={item.id} className="w-24 shrink-0">
                                    <img
                                        src={item.thumbnailUrl}
                                        alt="Board upload"
                                        className="aspect-square w-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => onAssignImage(item.id, pin.id)}
                                        className="text-10 mt-1 underline"
                                    >
                                        {item.pinId ? "Move here" : "Attach"}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : null}
                {error ? (
                    <p className="text-12 mt-3" role="alert">
                        {error}
                    </p>
                ) : null}
                <div className="mt-7 grid gap-5 sm:grid-cols-[8rem_1fr]">
                    <label className="text-12 text-graphite">
                        Time
                        <input
                            type="time"
                            value={draft.time}
                            onChange={(event) => setDraft({ ...draft, time: event.target.value })}
                            className="border-line text-15 text-foreground mt-2 w-full border-b bg-transparent py-2 outline-none"
                        />
                    </label>
                    <label className="text-12 text-graphite">
                        Title
                        <input
                            value={draft.title}
                            onChange={(event) =>
                                setDraft({
                                    ...draft,
                                    title: event.target.value
                                })
                            }
                            className="border-line text-15 text-foreground mt-2 w-full border-b bg-transparent py-2 outline-none"
                        />
                    </label>
                </div>
                <label className="text-12 text-graphite mt-5 block">
                    Category
                    <span className="border-line mt-2 flex items-center gap-3 border-b py-2">
                        <PinCategoryIcon category={draft.category} />
                        <select
                            value={draft.category}
                            onChange={(event) =>
                                setDraft({
                                    ...draft,
                                    category: event.target.value as PinCategory
                                })
                            }
                            className="text-14 text-foreground min-w-0 flex-1 bg-transparent outline-none"
                        >
                            {pinCategories.map((item) => (
                                <option key={item.value} value={item.value}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    </span>
                </label>
                <label className="text-12 text-graphite mt-5 block">
                    Notes
                    <textarea
                        rows={4}
                        value={draft.description}
                        onChange={(event) =>
                            setDraft({
                                ...draft,
                                description: event.target.value
                            })
                        }
                        className="border-line text-14 text-foreground mt-2 w-full resize-y border bg-transparent p-3 outline-none"
                    />
                </label>
                {draft.location ? (
                    <p className="text-12 text-muted-foreground mt-4 leading-5">{draft.location.address}</p>
                ) : null}
                <div className="mt-8 flex flex-wrap justify-between gap-3">
                    <button type="button" onClick={onDelete} className="border-line text-13 border px-5 py-3">
                        Delete activity
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (draft.title.trim()) {
                                onSave({
                                    ...draft,
                                    title: draft.title.trim(),
                                    description: draft.description.trim()
                                });
                                onClose();
                            }
                        }}
                        className="border-foreground bg-foreground text-13 text-background border px-6 py-3"
                    >
                        Save pin
                    </button>
                </div>
            </div>
        </div>
    );
}
