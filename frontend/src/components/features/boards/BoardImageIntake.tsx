/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useId, useRef, useState } from "react";

import BoardCoverHero from "@/components/features/boards/BoardCoverHero";
import CreatorUploadArtwork from "@/components/features/boards/CreatorUploadArtwork";
import { uploadBoardImage } from "@/lib/board-creator-api";
import { uploadBoardImageBatch } from "@/lib/board-image-upload";
import { toast } from "sonner";
import { creatorToastOptions } from "./CreatorNotifications";
import type { BoardImageDraft, BoardPinDraft } from "@/types/board-creator";

const MAX_IMAGES = 10;

export type UploadedBoardImage = {
    image: BoardImageDraft;
    suggestedPin: BoardPinDraft | null;
    suggestedDate: string | null;
};

type Props = {
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

function capturedTime(value: string | null, index: number): string {
    const match = value?.match(/[T\s](\d{2}):(\d{2})/);
    if (match?.[1] && match[2]) return `${match[1]}:${match[2]}`;
    return `${String(9 + index).padStart(2, "0")}:00`;
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
            time: capturedTime(asset.capturedAt, index),
            title: "Photo location",
            description: "Suggested from embedded GPS. Confirm the place before publishing.",
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
    const [error, setError] = useState("");
    const remaining = MAX_IMAGES - images.length;
    const cover = images.find((image) => image.uploadedImageId === coverImageId);

    async function upload(files: File[]) {
        if (disabled || uploadLock.current || files.length === 0) return;
        if (files.length > remaining) {
            setError(`Choose no more than ${remaining} additional image${remaining === 1 ? "" : "s"}.`);
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
                if (prepared.length) onUploaded(prepared);
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
        <section
            id="board-images"
            tabIndex={-1}
            aria-label="Board images"
            aria-busy={busy || loading}
            className="mx-auto w-[92%] max-w-[78rem] scroll-mt-36 focus-visible:outline-1 focus-visible:outline-offset-4 sm:w-[80%]"
        >
            <input
                ref={inputRef}
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                className="hidden"
                aria-label="Upload Board images"
                disabled={disabled || busy || remaining === 0}
                onChange={(event) => void upload(Array.from(event.target.files ?? []))}
            />
            {showDropZone ? (
                <div
                    className="relative aspect-[1254/706] min-h-[22rem] w-full text-center sm:min-h-0"
                    onDragOver={(event) => {
                        if (!disabled && !busy) event.preventDefault();
                    }}
                    onDrop={(event) => {
                        event.preventDefault();
                        if (!disabled && !busy) void upload(Array.from(event.dataTransfer.files));
                    }}
                >
                    <CreatorUploadArtwork />
                    <div className="absolute inset-x-4 top-[9%] z-10 sm:top-[12%]">
                        <h2
                            id="image-intake-heading"
                            className="text-muted-foreground text-24 sm:text-30 leading-[1.2] font-normal"
                        >
                            drop your
                            <br />
                            images
                            <br />
                            here
                        </h2>
                        <p className="text-muted-foreground mx-auto mt-4 max-w-64 text-[11px] leading-relaxed sm:text-xs">
                            Up to 10 images. Review the suggested places and capture times before publishing.
                        </p>
                        <button
                            type="button"
                            disabled={disabled || busy || remaining === 0}
                            onClick={() => inputRef.current?.click()}
                            className="border-line bg-background/90 text-foreground hover:border-foreground mt-4 min-h-11 cursor-pointer border px-5 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                        >
                            {busy ? "Uploading images..." : remaining === 0 ? "10 images added" : "choose images"}
                        </button>
                    </div>
                </div>
            ) : null}

            <BoardCoverHero
                coverUrl={cover?.url}
                loading={loading}
                disabled={disabled || busy || remaining === 0}
                onChooseImages={() => inputRef.current?.click()}
            />
            {busy ? (
                <p role="status" className="text-muted-foreground mt-4 text-center text-xs">
                    Uploading images…
                </p>
            ) : null}

            {error ? (
                <p className="text-14 mt-4 text-center break-words" role="alert">
                    {error}
                </p>
            ) : null}
            {images.length > 0 ? (
                <p className="text-11 text-graphite mt-4">
                    One image is the Board cover. Open an activity to attach its photos.
                </p>
            ) : null}
            {images.length > 0 ? (
                <ul className="mt-5 flex snap-x gap-3 overflow-x-auto pb-2" aria-label="Uploaded Board images">
                    {images.map((image, index) => (
                        <li key={image.id} className="relative w-24 shrink-0 snap-start">
                            <img
                                src={image.thumbnailUrl}
                                alt={`Board image ${index + 1}`}
                                className="aspect-square w-full object-cover"
                            />
                            {image.uploadedImageId === coverImageId ? (
                                <span className="text-9 mt-1 block font-bold">Board cover</span>
                            ) : (
                                <button
                                    type="button"
                                    disabled={disabled || busy}
                                    onClick={() => onSelectCover(image.uploadedImageId!)}
                                    data-board-cover-choice=""
                                    className="text-9 mt-1 block underline disabled:opacity-40"
                                >
                                    Set as cover
                                </button>
                            )}
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
    );
}
