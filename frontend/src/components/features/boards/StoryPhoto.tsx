"use client";

import Image from "next/image";
import { useState } from "react";
import type { BoardImage } from "@/types/board";

export function StoryPhotoCredit({ image }: { image: BoardImage }) {
    if (!image.photographer) return null;
    return (
        <figcaption className="text-muted-foreground mt-2 max-w-full truncate text-[10px] leading-relaxed">
            Photo by{" "}
            {image.photographerUrl ? (
                <a
                    className="underline underline-offset-2"
                    href={image.photographerUrl}
                    target="_blank"
                    rel="noreferrer"
                >
                    {image.photographer}
                </a>
            ) : (
                image.photographer
            )}
            {image.sourceUrl ? (
                <>
                    {" "}
                    on{" "}
                    <a className="underline underline-offset-2" href={image.sourceUrl} target="_blank" rel="noreferrer">
                        Unsplash
                    </a>
                </>
            ) : null}
        </figcaption>
    );
}

// Layout crops are viewer-only. The gallery receives the unchanged saved image.
export default function StoryPhoto({
    image,
    onOpen,
    eager = false,
    aspectRatio,
    thumbnail = false
}: {
    image: BoardImage;
    onOpen: () => void;
    eager?: boolean;
    aspectRatio?: number;
    thumbnail?: boolean;
}) {
    const [failed, setFailed] = useState(false);
    const ratio = image.width && image.height ? image.width / image.height : 4 / 3;
    const crop =
        aspectRatio !== undefined &&
        !(image.width && image.height && (Math.min(image.width, image.height) < 32 || ratio < 0.1 || ratio > 10));
    return (
        <figure
            className="flex max-w-full shrink-0 flex-col"
            style={{
                width: aspectRatio
                    ? thumbnail
                        ? "100%"
                        : `min(100cqw, calc((100cqh - 1.5rem) * ${aspectRatio}))`
                    : `min(100%, ${image.width || 800}px)`
            }}
        >
            <button
                type="button"
                onClick={onOpen}
                aria-label={`Enlarge ${image.alt}`}
                className="relative block w-full cursor-zoom-in overflow-hidden outline-offset-4 transition-transform hover:scale-[1.025] focus-visible:outline-2 motion-reduce:transform-none"
                style={{ aspectRatio: aspectRatio || ratio }}
            >
                {failed ? (
                    <span className="text-muted-foreground p-4 text-xs">Saved photo unavailable</span>
                ) : (
                    <Image
                        src={image.url}
                        alt={image.alt}
                        fill
                        sizes={thumbnail ? "96px" : "(max-width: 1024px) 80vw, 40vw"}
                        unoptimized
                        loading={eager ? "eager" : "lazy"}
                        onError={() => setFailed(true)}
                        className={crop ? "object-cover" : "object-scale-down"}
                    />
                )}
            </button>
            {!thumbnail ? <StoryPhotoCredit image={image} /> : null}
        </figure>
    );
}
