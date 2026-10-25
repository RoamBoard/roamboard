/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import PhotoEditorDialog from "@/components/images/PhotoEditorDialog";
import { usePhotoUrls } from "@/lib/use-photo-urls";
import BoardCoverHero from "@/components/features/boards/BoardCoverHero";
import BoardCoverDialog from "./BoardCoverDialog";

import BoardPhotoStrip from "./BoardPhotoStrip";
import EditorPhotoGallery from "./EditorPhotoGallery";
import { Crop, Link2, Link2Off, Trash2, Upload } from "lucide-react";
import { uploadBoardImage, suggestBoardPhotos } from "@/lib/board-creator-api";
import { uploadBoardImageBatch } from "@/lib/board-image-upload";
import { toast } from "sonner";
import { creatorToastOptions } from "./CreatorNotifications";
import type { BoardImageDraft, BoardPinDraft } from "@/types/board-creator";

const MAX_IMAGES = 30;
const BOARD_PHOTO_DRAG_TYPE = "application/x-roamboard-cover-image";

export type UploadedBoardImage = {
    warning?: string;
    image: BoardImageDraft;
    suggestedPin: BoardPinDraft | null;
    suggestedDate: string | null;
};

type Props = {
    children?: ReactNode;
    images: BoardImageDraft[];
    coverImageId: number | null;
    disabled?: boolean;
    loading?: boolean;
    showDropZone?: boolean;
    showCover?: boolean;
    showGallery?: boolean;
    onUploadingChange?: (uploading: boolean) => void;
    onUploadPromise?: (promise: Promise<unknown>) => void;
    onSelectCover: (imageId: number) => void;
    onUploaded: (items: UploadedBoardImage[]) => void;
    onRemove: (imageId: string) => void;
};

function capturedTime(value: string | null): string {
    const match = value?.match(/[T\s](\d{2}):(\d{2})/);
    if (match?.[1] && match[2]) return `${match[1]}:${match[2]}`;
    return "";
}

function capturedDate(value: string | null): string | null {
    const match = value?.match(/(\d{4})[:-](\d{2})[:-](\d{2})/);
    return match?.[1] && match[2] && match[3] ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function prepareUpload(asset: Awaited<ReturnType<typeof uploadBoardImage>>, index: number): UploadedBoardImage {
    const imageId = crypto.randomUUID();
    const image: BoardImageDraft = {
        id: imageId,
        uploadedImageId: asset.imageId,
        pinId: null,
        publicId: String(asset.imageId),
        source: "upload",
        url: asset.url,
        thumbnailUrl: asset.thumbnailUrl,
        width: 0,
        height: 0,
        capturedAt: asset.capturedAt,
        latitude: asset.latitude,
        longitude: asset.longitude,
        order: index,
        credit: null,
        creditUrl: null,
        sourceUrl: null
    };
    if (asset.latitude === null || asset.longitude === null) {
        return {
            image,
            suggestedPin: null,
            suggestedDate: capturedDate(asset.capturedAt)
        };
    }
    const pinId = crypto.randomUUID();
    return {
        image: { ...image, pinId },
        suggestedDate: capturedDate(asset.capturedAt),
        suggestedPin: {
            id: pinId,
            order: index,
            time: capturedTime(asset.capturedAt),
            title: "Photo location",
            description: "",
            category: "other",
            source: "photo",
            location: {
                name: "Photo location",
                address: `${asset.latitude.toFixed(5)}, ${asset.longitude.toFixed(5)}`,
                latitude: asset.latitude,
                longitude: asset.longitude,
                country: null,
                countryCode: null,
                city: null,
                mapboxId: null
            }
        }
    };
}

export default function BoardImageIntake({
    children,
    images,
    coverImageId,
    disabled = false,
    loading = false,
    showDropZone = true,
    showCover = true,
    showGallery = true,
    onUploadingChange,
    onUploadPromise,
    onSelectCover,
    onUploaded,
    onRemove
}: Props) {
    const photoUrl = usePhotoUrls();
    const [editingPhoto, setEditingPhoto] = useState<number | null>(null);
    const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
    const [choosingCover, setChoosingCover] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const uploadId = useId();
    const uploadLock = useRef(false);
    useEffect(
        () => () => {
            toast.dismiss(uploadId);
        },
        [uploadId]
    );
    const [completedUploads, setCompletedUploads] = useState<Awaited<ReturnType<typeof uploadBoardImage>>[]>([]);
    const [batchSize, setBatchSize] = useState(0);
    const [busy, setBusy] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState("");

    const uploadedPhotos = images.filter((image) => image.source === "upload");
    const cover = images.find((image) => image.uploadedImageId === coverImageId);

    async function upload(files: File[], asCover = false) {
        if (disabled || uploadLock.current || files.length === 0) return;
        if (files.length > MAX_IMAGES) {
            setError("Choose up to 30 photos per batch. You can upload another batch afterwards.");
            return;
        }
        uploadLock.current = true;
        toast.loading("Uploading Board images…", { ...creatorToastOptions, id: uploadId });
        setCompletedUploads([]);
        setBatchSize(files.length);
        setBusy(true);
        onUploadingChange?.(true);
        setError("");
        const uploadTask = (async () => {
            try {
                const { assets, failures } = await uploadBoardImageBatch(files, (asset) => {
                    setCompletedUploads((current) => [...current, asset]);
                });
                const prepared = assets.map((asset, index) => prepareUpload(asset, images.length + index));
                if (showDropZone && prepared.length) {
                    toast.loading("Finding activity suggestions...", { ...creatorToastOptions, id: uploadId });
                    try {
                        const suggestions = await suggestBoardPhotos(assets.map((asset) => asset.imageId));
                        for (const item of prepared) {
                            const suggestion = suggestions.find(
                                (value) => value.imageId === item.image.uploadedImageId
                            );
                            if (suggestion?.warning) item.warning = suggestion.warning;
                            if (!item.suggestedPin || !suggestion?.location) continue;
                            const place = suggestion.location;
                            item.suggestedPin = {
                                ...item.suggestedPin,
                                title: place.detail || place.label || place.address,
                                category: suggestion.category,
                                description: "",
                                location: {
                                    name: place.detail || place.label || place.address,
                                    address: place.address,
                                    latitude: item.image.latitude!,
                                    longitude: item.image.longitude!,
                                    country: place.country,
                                    countryCode: place.countryCode,
                                    city: place.city,
                                    mapboxId: place.id
                                }
                            };
                        }
                    } catch {
                        for (const item of prepared)
                            item.warning =
                                "Place lookup failed. Photos are uploaded; review their GPS suggestions or assign them manually.";
                    }
                }
                if (prepared.length && (asCover || showCover)) onSelectCover(prepared[0]!.image.uploadedImageId!);
                if (prepared.length)
                    onUploaded(showDropZone ? prepared : prepared.map((item) => ({ ...item, suggestedPin: null })));
                if (failures.length) {
                    const detail = `${assets.length} uploaded; ${failures.length} failed. Retry only the failed files. ${failures.join(" ")}`;
                    setError(detail);
                    toast.error("Some images could not be uploaded", {
                        ...creatorToastOptions,
                        id: uploadId,
                        description: `${assets.length} uploaded; ${failures.length} failed. Details are beside your images.`
                    });
                } else {
                    toast.success(`${assets.length} ${assets.length === 1 ? "image" : "images"} uploaded`, {
                        ...creatorToastOptions,
                        id: uploadId,
                        description: "Save your Board to keep these changes."
                    });
                }
            } catch (caught) {
                const detail = caught instanceof Error ? caught.message : "The images could not be uploaded.";
                setError(detail);
                toast.error("Images could not be uploaded", {
                    ...creatorToastOptions,
                    id: uploadId,
                    description: detail
                });
            } finally {
                uploadLock.current = false;
                setBusy(false);
                onUploadingChange?.(false);
                if (inputRef.current) inputRef.current.value = "";
            }
        })();
        onUploadPromise?.(uploadTask);
        await uploadTask;
    }

    return (
        <>
            {galleryIndex !== null ? (
                <EditorPhotoGallery
                    images={uploadedPhotos}
                    index={galleryIndex}
                    onClose={() => setGalleryIndex(null)}
                />
            ) : null}
            {choosingCover ? (
                <BoardCoverDialog
                    images={images}
                    coverImageId={coverImageId}
                    onRemove={onRemove}
                    onSelect={onSelectCover}
                    onClose={() => setChoosingCover(false)}
                    onUpload={() => {
                        setChoosingCover(false);
                        inputRef.current?.click();
                    }}
                />
            ) : null}
            {editingPhoto !== null ? (
                <PhotoEditorDialog imageId={editingPhoto} onClose={() => setEditingPhoto(null)} />
            ) : null}
            <section
                id={showCover ? "board-images" : "plan-images"}
                tabIndex={-1}
                aria-label="Board setup and images"
                aria-busy={busy || loading}
                className="w-full min-w-0 scroll-mt-36 focus-visible:outline-1 focus-visible:outline-offset-4"
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*,.heic,.heif"
                    multiple
                    className="hidden"
                    aria-label="Upload Board images"
                    disabled={disabled || busy}
                    onChange={(event) => void upload(Array.from(event.target.files ?? []))}
                />
                {showCover ? (
                    <div
                        className={`group/cover relative mx-auto w-full rounded-[2rem] ${dragging ? "outline-foreground outline-2" : ""}`}
                        onDragOver={(event) => {
                            if (
                                disabled ||
                                busy ||
                                (!event.dataTransfer.types.includes("Files") &&
                                    !event.dataTransfer.types.includes(BOARD_PHOTO_DRAG_TYPE))
                            )
                                return;
                            event.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(event) => {
                            event.preventDefault();
                            setDragging(false);
                            if (disabled || busy) return;
                            const id = Number(event.dataTransfer.getData(BOARD_PHOTO_DRAG_TYPE));
                            if (images.some((image) => image.uploadedImageId === id)) onSelectCover(id);
                            else void upload(Array.from(event.dataTransfer.files), true);
                        }}
                    >
                        <BoardCoverHero
                            coverUrl={cover ? photoUrl(cover.url) : undefined}
                            loading={loading}
                            disabled={disabled || busy}
                            onChooseImages={() =>
                                uploadedPhotos.length ? setChoosingCover(true) : inputRef.current?.click()
                            }
                        />
                    </div>
                ) : null}
                {children}
                {!showCover && !showDropZone ? (
                    <button
                        type="button"
                        disabled={disabled || busy}
                        onClick={() => inputRef.current?.click()}
                        className="group/action my-4 inline-flex min-h-11 items-center gap-3 text-sm"
                    >
                        <Upload className="border-line size-10 rounded-full border p-2.5 transition-transform group-hover/action:scale-110 motion-reduce:transition-none" />{" "}
                        Add photos
                    </button>
                ) : null}
                <div
                    className={`relative mx-auto w-full transition-colors motion-reduce:transition-none ${showDropZone ? "mb-8" : ""} ${dragging ? "bg-foreground/[0.04] outline-foreground/50 outline-1 outline-offset-8 outline-dashed" : ""}`}
                    onDragOver={(event) => {
                        if (!showDropZone) return;
                        const existingPhoto = event.dataTransfer.types.includes(BOARD_PHOTO_DRAG_TYPE);
                        const files = event.dataTransfer.types.includes("Files");
                        if (!existingPhoto && !files) return;
                        event.preventDefault();
                        if (disabled || busy) {
                            event.dataTransfer.dropEffect = "none";
                            return;
                        }
                        event.dataTransfer.dropEffect = existingPhoto ? "move" : "copy";
                        setDragging(true);
                    }}
                    onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
                    }}
                    onDrop={(event) => {
                        if (!showDropZone) return;
                        event.preventDefault();
                        setDragging(false);
                        if (disabled || busy) return;
                        const photoId = Number(event.dataTransfer.getData(BOARD_PHOTO_DRAG_TYPE));
                        if (images.some((image) => image.uploadedImageId === photoId)) {
                            onSelectCover(photoId);
                            return;
                        }
                        void upload(Array.from(event.dataTransfer.files));
                    }}
                >
                    {showDropZone ? (
                        <header className="border-line bg-faint/40 relative overflow-hidden rounded-3xl border border-dashed px-6 py-8 text-left sm:px-10">
                            <div className="relative max-w-2xl">
                                <h2
                                    id="image-intake-heading"
                                    className="font-display text-3xl leading-none font-bold tracking-[-0.035em]"
                                >
                                    Smart Create
                                </h2>
                                <p className="text-muted-foreground mt-3 max-w-xl text-xs leading-relaxed sm:text-sm">
                                    Already back from your trip? Drop in your activity photos. We will try to fill in
                                    your day plan from location and date details. You can edit every suggestion.
                                </p>
                                <button
                                    type="button"
                                    disabled={disabled || busy}
                                    onClick={() => inputRef.current?.click()}
                                    className="group/action text-foreground mt-5 inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <Upload
                                        aria-hidden="true"
                                        className="border-line size-10 rounded-full border p-2.5 transition-transform group-hover/action:scale-110 group-focus-visible/action:scale-110 motion-reduce:transition-none"
                                        strokeWidth={1.5}
                                    />
                                    {busy ? "Uploading images..." : "Add photos"}
                                </button>
                                <p className="text-muted-foreground mt-1 text-[11px]">
                                    Up to 30 photos per batch. Adding more later? Start with the first days of your
                                    trip.
                                </p>
                            </div>
                        </header>
                    ) : null}
                    {dragging ? (
                        <p
                            role="status"
                            className="pointer-events-none absolute inset-x-4 top-4 text-center text-xs font-medium"
                        >
                            Release your photo here
                        </p>
                    ) : null}
                </div>

                {busy ? (
                    <p role="status" className="text-muted-foreground mx-auto mt-4 w-full text-center text-xs">
                        {completedUploads.length} of {batchSize} photos uploaded
                        {completedUploads.length === batchSize ? " - Finding activity suggestions..." : "..."}
                    </p>
                ) : null}

                {busy && completedUploads.length > 0 ? (
                    <ul aria-label="Photos uploaded in this batch" className="mt-4 flex gap-3 overflow-x-auto pb-2">
                        {completedUploads.map((asset) => (
                            <li key={asset.imageId} className="shrink-0">
                                <img
                                    src={asset.thumbnailUrl}
                                    alt="Uploaded photo"
                                    width={96}
                                    height={96}
                                    className="size-24 rounded-xl object-cover"
                                />
                            </li>
                        ))}
                    </ul>
                ) : null}

                {error ? (
                    <p className="text-14 mx-auto mt-4 w-full text-center break-words" role="alert">
                        {error}
                    </p>
                ) : null}
                {showGallery && uploadedPhotos.length > 0 ? (
                    <div className="my-8">
                        <BoardPhotoStrip label="Uploaded Board images">
                            {uploadedPhotos.map((image, index) => (
                                <li key={image.id} className="group/photo relative w-56 min-w-0 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setGalleryIndex(index)}
                                        aria-label={`Enlarge Board photo ${index + 1}`}
                                        className="editor-photo-card block w-full overflow-hidden rounded-2xl focus-visible:outline-2"
                                    >
                                        <img
                                            src={photoUrl(image.thumbnailUrl)}
                                            loading="lazy"
                                            decoding="async"
                                            width={224}
                                            height={224}
                                            alt={`Board image ${index + 1}`}
                                            draggable={false}
                                            className="aspect-square w-full object-cover"
                                        />
                                    </button>
                                    <div className="editor-photo-actions">
                                        {image.uploadedImageId ? (
                                            <button
                                                type="button"
                                                disabled={disabled || busy}
                                                className="editor-icon-action"
                                                aria-label={`Crop photo ${index + 1}`}
                                                title="Crop"
                                                onClick={() => setEditingPhoto(image.uploadedImageId!)}
                                            >
                                                <Crop size={16} />
                                            </button>
                                        ) : null}
                                        <button
                                            type="button"
                                            disabled={disabled || busy}
                                            onClick={() => onRemove(image.id)}
                                            className="editor-icon-action"
                                            aria-label={`Remove image ${index + 1}`}
                                            title="Remove from Board"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between gap-3 px-1 text-xs">
                                        <button
                                            type="button"
                                            disabled={disabled || busy}
                                            aria-pressed={image.uploadedImageId === coverImageId}
                                            onClick={() => onSelectCover(image.uploadedImageId!)}
                                            data-board-cover-choice=""
                                            draggable={!disabled && !busy}
                                            onDragStart={(event) => {
                                                event.dataTransfer.setData(
                                                    BOARD_PHOTO_DRAG_TYPE,
                                                    String(image.uploadedImageId)
                                                );
                                                event.dataTransfer.effectAllowed = "copy";
                                            }}
                                            className="min-h-10 underline underline-offset-4 disabled:opacity-40"
                                        >
                                            {image.uploadedImageId === coverImageId ? "Board cover" : "Set as cover"}
                                        </button>
                                        <span
                                            role="img"
                                            aria-label={image.pinId ? "Linked to an activity" : "Available to attach"}
                                            title={image.pinId ? "Linked to an activity" : "Available to attach"}
                                            className="text-muted-foreground"
                                        >
                                            {image.pinId ? <Link2 size={16} /> : <Link2Off size={16} />}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </BoardPhotoStrip>
                    </div>
                ) : null}
            </section>
        </>
    );
}
