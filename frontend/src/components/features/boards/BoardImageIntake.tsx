/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import PhotoEditorDialog from "@/components/images/PhotoEditorDialog";
import { usePhotoUrls } from "@/lib/use-photo-urls";
import BoardCoverHero from "@/components/features/boards/BoardCoverHero";
import BoardCoverDialog from "./BoardCoverDialog";
import CreatorUploadArtwork from "@/components/features/boards/CreatorUploadArtwork";
import { Upload } from "lucide-react";
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
    onUploadingChange,
    onUploadPromise,
    onSelectCover,
    onUploaded,
    onRemove
}: Props) {
    const photoUrl = usePhotoUrls();
    const [editingPhoto, setEditingPhoto] = useState<number | null>(null);
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
    const [busy, setBusy] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState("");

    const uploadedPhotos = images.filter((image) => image.source === "upload");
    const unassignedPhotos = uploadedPhotos.filter((image) => !image.pinId);
    const cover = images.find((image) => image.uploadedImageId === coverImageId);

    async function upload(files: File[]) {
        if (disabled || uploadLock.current || files.length === 0) return;
        if (files.length > MAX_IMAGES) {
            setError("Choose up to 30 photos per batch. You can upload another batch afterwards.");
            return;
        }
        uploadLock.current = true;
        toast.loading("Uploading Board images…", { ...creatorToastOptions, id: uploadId });
        setBusy(true);
        onUploadingChange?.(true);
        setError("");
        const uploadTask = (async () => {
            try {
                const { assets, failures } = await uploadBoardImageBatch(files);
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
            {choosingCover ? (
                <BoardCoverDialog
                    images={images}
                    coverImageId={coverImageId}
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
                id="board-images"
                aria-label="Board setup and images"
                aria-busy={busy || loading}
                className="w-full min-w-0 scroll-mt-36"
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
                <div className="group/cover relative mx-auto w-[92%] max-w-[78rem] sm:w-[80%]">
                    <BoardCoverHero
                        coverUrl={cover ? photoUrl(cover.url) : undefined}
                        loading={loading}
                        disabled={disabled || busy}
                        onChooseImages={() => setChoosingCover(true)}
                    />
                </div>
                {children}
                <div
                    className={`relative mx-auto w-[92%] max-w-[78rem] transition-colors motion-reduce:transition-none sm:w-[80%] ${showDropZone ? "mb-16 sm:mb-24" : ""} ${dragging ? "bg-foreground/[0.04] outline-foreground/50 outline-1 outline-offset-8 outline-dashed" : ""}`}
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
                        <header className="relative isolate min-h-[26rem] overflow-hidden px-4 pt-10 pb-48 text-center sm:min-h-[32rem] sm:pt-12 sm:pb-64">
                            <CreatorUploadArtwork />
                            <div className="relative mx-auto max-w-xl">
                                <h2
                                    id="image-intake-heading"
                                    className="font-display text-[clamp(2rem,4.5vw,4.5rem)] leading-none font-bold tracking-[-0.035em]"
                                >
                                    SMART CREATE
                                </h2>
                                <p className="text-muted-foreground mx-auto mt-4 max-w-sm text-xs leading-relaxed sm:text-sm">
                                    Already back from your trip? Drop in your activity photos. We will try to fill in
                                    your day plan from location and date details. You can edit every suggestion.
                                </p>
                                <button
                                    type="button"
                                    disabled={disabled || busy}
                                    onClick={() => inputRef.current?.click()}
                                    className="text-foreground mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 px-3 text-xs underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <Upload aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
                                    {busy ? "Uploading images..." : images.length ? "Add photos" : "Choose photos"}
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
                    <p
                        role="status"
                        className="text-muted-foreground mx-auto mt-4 w-[92%] max-w-[78rem] text-center text-xs sm:w-[80%]"
                    >
                        Uploading images…
                    </p>
                ) : null}

                {error ? (
                    <p
                        className="text-14 mx-auto mt-4 w-[92%] max-w-[78rem] text-center break-words sm:w-[80%]"
                        role="alert"
                    >
                        {error}
                    </p>
                ) : null}
                {uploadedPhotos.length > 0 ? (
                    <p className="text-11 text-graphite mx-auto mt-4 w-[92%] max-w-[78rem] sm:w-[80%]">
                        {unassignedPhotos.length
                            ? `${unassignedPhotos.length} ${unassignedPhotos.length === 1 ? "photo is" : "photos are"} not linked to an activity. Open an activity to attach photos.`
                            : "All uploaded photos are linked to activities."}
                    </p>
                ) : null}
                {uploadedPhotos.length > 0 ? (
                    <ul
                        className="mx-auto mt-5 mb-16 flex w-[92%] max-w-[78rem] snap-x gap-3 overflow-x-auto pb-2 sm:w-[80%]"
                        aria-label="Uploaded Board images"
                    >
                        {uploadedPhotos.map((image, index) => (
                            <li key={image.id} className="group/photo relative w-24 shrink-0 snap-start">
                                <img
                                    src={photoUrl(image.thumbnailUrl)}
                                    loading="lazy"
                                    decoding="async"
                                    width={96}
                                    height={96}
                                    alt={`Board image ${index + 1}`}
                                    className={
                                        showDropZone && !disabled && !busy
                                            ? "aspect-square w-full cursor-grab object-cover active:cursor-grabbing"
                                            : "aspect-square w-full object-cover"
                                    }
                                    draggable={showDropZone && !disabled && !busy}
                                    onDragStart={(event) => {
                                        if (!showDropZone || disabled || busy || !image.uploadedImageId) {
                                            event.preventDefault();
                                            return;
                                        }
                                        event.dataTransfer.setData(
                                            BOARD_PHOTO_DRAG_TYPE,
                                            String(image.uploadedImageId)
                                        );
                                        event.dataTransfer.effectAllowed = "move";
                                        setDragging(true);
                                    }}
                                    onDragEnd={() => setDragging(false)}
                                />
                                {showDropZone && !disabled && !busy ? (
                                    <span className="bg-background/95 pointer-events-none absolute inset-x-0 top-12 px-1 py-1 text-center text-[10px] leading-tight opacity-0 transition-opacity group-hover/photo:opacity-100 motion-reduce:transition-none">
                                        Drag to Smart Create to use as cover
                                    </span>
                                ) : null}
                                {image.uploadedImageId === coverImageId ? (
                                    <span className="text-9 mt-1 block font-bold">Board cover</span>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={disabled || busy}
                                        onClick={() => onSelectCover(image.uploadedImageId!)}
                                        className="text-9 mt-1 block underline disabled:opacity-40"
                                    >
                                        Set as cover
                                    </button>
                                )}
                                {image.uploadedImageId ? (
                                    <button
                                        type="button"
                                        disabled={disabled || busy}
                                        className="mt-1 block text-[10px] underline"
                                        onClick={() => setEditingPhoto(image.uploadedImageId!)}
                                    >
                                        Crop / resize
                                    </button>
                                ) : null}
                                <span className="text-muted-foreground mt-1 block text-[10px]">
                                    {image.pinId ? "Linked to an activity" : "Not linked to an activity"}
                                </span>
                                {image.capturedAt === null ? (
                                    <span className="text-9 text-graphite mt-1 block">No metadata available</span>
                                ) : null}
                                <button
                                    type="button"
                                    disabled={disabled || busy}
                                    onClick={() => onRemove(image.id)}
                                    className="bg-background/90 text-14 absolute top-1 right-1 grid size-6 place-items-center disabled:opacity-40"
                                    aria-label={`Remove image ${index + 1}`}
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </section>
        </>
    );
}
