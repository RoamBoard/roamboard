/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";

import { uploadBoardImage } from "@/lib/board-creator-api";
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
    return match?.[1] && match[2] && match[3]
        ? `${match[1]}-${match[2]}-${match[3]}`
        : null;
}

function prepareUpload(
    asset: Awaited<ReturnType<typeof uploadBoardImage>>,
    index: number
): UploadedBoardImage {
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
            description:
                "Suggested from embedded GPS. Confirm the place before publishing.",
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
    onSelectCover,
    onUploaded,
    onRemove
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const remaining = MAX_IMAGES - images.length;
    const cover = images.find(
        (image) => image.uploadedImageId === coverImageId
    );

    async function upload(files: File[]) {
        if (files.length === 0) return;
        if (files.length > remaining) {
            setError(
                `Choose no more than ${remaining} additional image${remaining === 1 ? "" : "s"}.`
            );
            return;
        }
        setBusy(true);
        setError("");
        try {
            const assets = await Promise.all(
                files.map((file) => uploadBoardImage(file))
            );
            const prepared = assets.map((asset, index) =>
                prepareUpload(asset, images.length + index)
            );
            onUploaded(prepared);
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "The images could not be uploaded."
            );
        } finally {
            setBusy(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    }

    return (
        <section
            aria-labelledby="image-intake-heading"
            className="mx-auto w-full max-w-5xl"
        >
            <div
                className="border-line relative grid min-h-80 place-items-center overflow-hidden border-x px-8 text-center sm:min-h-96"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                    event.preventDefault();
                    void upload(Array.from(event.dataTransfer.files));
                }}
            >
                <div
                    aria-hidden="true"
                    className="absolute inset-x-[6%] top-20 bottom-0 opacity-70"
                >
                    {Array.from({ length: 24 }, (_, index) => (
                        <span
                            key={index}
                            className="bg-line absolute bottom-0 w-px"
                            style={{
                                left: `${(index / 23) * 100}%`,
                                height: `${34 + Math.abs(index - 11.5) * 4.5}%`
                            }}
                        >
                            <span className="border-line bg-background absolute top-0 -left-1 size-2 rounded-full border" />
                        </span>
                    ))}
                </div>
                <div className="relative z-10">
                    <h2
                        id="image-intake-heading"
                        className="font-display text-24 text-line sm:text-30 leading-none"
                    >
                        drop your
                        <br />
                        images
                        <br />
                        here
                    </h2>
                    <p className="text-12 text-graphite mt-5">
                        Up to 10 images. GPS and capture time become suggestions
                        you can edit.
                    </p>
                    <button
                        type="button"
                        disabled={busy || remaining === 0}
                        onClick={() => inputRef.current?.click()}
                        className="border-foreground bg-background text-12 text-foreground hover:bg-foreground hover:text-background mt-5 border px-5 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                    >
                        {busy
                            ? "Reading images..."
                            : remaining === 0
                              ? "10 images added"
                              : "choose images"}
                    </button>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*,.heic,.heif"
                        multiple
                        className="sr-only"
                        disabled={busy || remaining === 0}
                        onChange={(event) =>
                            void upload(Array.from(event.target.files ?? []))
                        }
                    />
                </div>
            </div>

            <div className="relative min-h-52 overflow-hidden rounded-b-[50%] bg-[url('/boards-create-cover.svg')] bg-cover bg-center sm:min-h-72">
                {cover ? (
                    <img
                        src={cover.url}
                        alt="Board cover"
                        className="absolute inset-0 size-full object-cover"
                    />
                ) : null}
                <button
                    type="button"
                    disabled={busy || remaining === 0}
                    onClick={() => inputRef.current?.click()}
                    className="absolute bottom-10 left-1/2 grid size-10 -translate-x-1/2 place-items-center border border-white bg-black/45 text-white backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-40"
                    aria-label="Choose Board images"
                >
                    +
                </button>
            </div>

            {error ? (
                <p className="text-14 mt-4 text-center" role="alert">
                    {error}
                </p>
            ) : null}
            {images.length > 0 ? (
                <p className="text-11 text-graphite mt-4">
                    One image is the Board cover. Open an activity to attach its
                    photos.
                </p>
            ) : null}
            {images.length > 0 ? (
                <ul
                    className="mt-5 flex snap-x gap-3 overflow-x-auto pb-2"
                    aria-label="Uploaded Board images"
                >
                    {images.map((image, index) => (
                        <li
                            key={image.id}
                            className="relative w-24 shrink-0 snap-start"
                        >
                            <img
                                src={image.thumbnailUrl}
                                alt={`Board image ${index + 1}`}
                                className="aspect-square w-full object-cover"
                            />
                            {image.uploadedImageId === coverImageId ? (
                                <span className="text-9 mt-1 block font-bold">
                                    Board cover
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() =>
                                        onSelectCover(image.uploadedImageId!)
                                    }
                                    className="text-9 mt-1 block underline"
                                >
                                    Set as cover
                                </button>
                            )}
                            {image.capturedAt === null ? (
                                <span className="text-9 text-graphite mt-1 block">
                                    No metadata available
                                </span>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => onRemove(image.id)}
                                className="bg-background/90 text-14 absolute top-1 right-1 grid size-6 place-items-center"
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
