/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";

import {
  reverseBoardLocationProvider,
  uploadCloudinaryProvider,
  type CloudinaryAsset,
} from "@/lib/providers";
import { categoryFromLocationType } from "@/lib/board-options";
import type { BoardImageDraft, BoardPinDraft } from "@/types/board-creator";

const MAX_IMAGES = 10;

export type UploadedBoardImage = {
  image: BoardImageDraft;
  suggestedPin: BoardPinDraft | null;
  suggestedDate: string | null;
};

type Props = {
  images: BoardImageDraft[];
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

async function prepareUpload(asset: CloudinaryAsset, index: number): Promise<UploadedBoardImage> {
  const imageId = crypto.randomUUID();
  const metadata = asset.metadata;
  const image: BoardImageDraft = {
    id: imageId,
    pinId: null,
    publicId: asset.publicId,
    source: "upload",
    url: asset.url,
    thumbnailUrl: asset.thumbnailUrl,
    width: asset.width,
    height: asset.height,
    capturedAt: metadata?.capturedAt ?? null,
    latitude: metadata?.latitude ?? null,
    longitude: metadata?.longitude ?? null,
    order: index,
    credit: null,
    creditUrl: null,
    sourceUrl: null,
  };
  if (!metadata?.hasGps || metadata.latitude === null || metadata.longitude === null) {
    return { image, suggestedPin: null, suggestedDate: capturedDate(metadata?.capturedAt ?? null) };
  }
  try {
    const place = await reverseBoardLocationProvider(String(metadata.latitude), String(metadata.longitude));
    const pinId = crypto.randomUUID();
    return {
      image: { ...image, pinId },
      suggestedDate: capturedDate(metadata.capturedAt),
      suggestedPin: {
        id: pinId,
        order: index,
        time: capturedTime(metadata.capturedAt, index),
        title: place.detail || place.label || "Photo location",
        description: "Suggested from photo location metadata. Confirm before publishing.",
        category: categoryFromLocationType(place.type),
        source: "photo",
        location: {
          name: place.detail || place.label || "Photo location",
          address: place.address ?? place.label,
          latitude: place.latitude,
          longitude: place.longitude,
          country: place.country ?? null,
          countryCode: place.countryCode ?? null,
          city: place.city ?? null,
          mapboxId: place.id,
        },
      },
    };
  } catch {
    const pinId = crypto.randomUUID();
    return {
      image: { ...image, pinId },
      suggestedDate: capturedDate(metadata.capturedAt),
      suggestedPin: {
        id: pinId,
        order: index,
        time: capturedTime(metadata.capturedAt, index),
        title: "Photo location",
        description: "Suggested from embedded GPS. Confirm the place before publishing.",
        category: "other",
        source: "photo",
        location: {
          name: "Photo location",
          address: `${metadata.latitude.toFixed(5)}, ${metadata.longitude.toFixed(5)}`,
          latitude: metadata.latitude,
          longitude: metadata.longitude,
          country: null,
          countryCode: null,
          city: null,
          mapboxId: null,
        },
      },
    };
  }
}

export default function BoardImageIntake({ images, onUploaded, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const remaining = MAX_IMAGES - images.length;

  async function upload(files: File[]) {
    if (files.length === 0) return;
    if (files.length > remaining) {
      setError(`Choose no more than ${remaining} additional image${remaining === 1 ? "" : "s"}.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const assets = await Promise.all(files.map((file) => uploadCloudinaryProvider(file)));
      const prepared = await Promise.all(assets.map((asset, index) => prepareUpload(asset, images.length + index)));
      onUploaded(prepared);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The images could not be uploaded.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section aria-labelledby="image-intake-heading" className="mx-auto w-full max-w-5xl">
      <div
        className="relative grid min-h-80 place-items-center overflow-hidden border-x border-line px-8 text-center sm:min-h-96"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void upload(Array.from(event.dataTransfer.files));
        }}
      >
        <div aria-hidden="true" className="absolute inset-x-[6%] bottom-0 top-20 opacity-70">
          {Array.from({ length: 24 }, (_, index) => (
            <span
              key={index}
              className="absolute bottom-0 w-px bg-line"
              style={{ left: `${(index / 23) * 100}%`, height: `${34 + Math.abs(index - 11.5) * 4.5}%` }}
            >
              <span className="absolute -left-1 top-0 size-2 rounded-full border border-line bg-background" />
            </span>
          ))}
        </div>
        <div className="relative z-10">
          <h2 id="image-intake-heading" className="font-display text-24 leading-none text-line sm:text-30">
            drop your<br />images<br />here
          </h2>
          <p className="mt-5 text-12 text-graphite">
            Up to 10 images. GPS and capture time become suggestions you can edit.
          </p>
          <button
            type="button"
            disabled={busy || remaining === 0}
            onClick={() => inputRef.current?.click()}
            className="mt-5 border border-foreground bg-background px-5 py-3 text-12 text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            {busy ? "Reading images..." : remaining === 0 ? "10 images added" : "choose images"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            className="sr-only"
            disabled={busy || remaining === 0}
            onChange={(event) => void upload(Array.from(event.target.files ?? []))}
          />
        </div>
      </div>

      <div className="relative min-h-52 overflow-hidden rounded-b-[50%] bg-[url('/boards-create-cover.svg')] bg-cover bg-center sm:min-h-72">
        {images[0] ? <img src={images[0].url} alt="Selected Board cover" className="absolute inset-0 size-full object-cover" /> : null}
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

      {error ? <p className="mt-4 text-center text-14" role="alert">{error}</p> : null}
      {images.length > 0 ? (
        <ul className="mt-5 flex snap-x gap-3 overflow-x-auto pb-2" aria-label="Uploaded Board images">
          {images.map((image, index) => (
            <li key={image.id} className="relative w-24 shrink-0 snap-start">
              <img src={image.thumbnailUrl} alt={`Board image ${index + 1}`} className="aspect-square w-full object-cover" />
              <button type="button" onClick={() => onRemove(image.id)} className="absolute right-1 top-1 grid size-6 place-items-center bg-background/90 text-14" aria-label={`Remove image ${index + 1}`}>×</button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
