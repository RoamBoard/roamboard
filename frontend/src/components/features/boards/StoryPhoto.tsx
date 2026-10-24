"use client";

import Image from "next/image";
import { useState } from "react";
import type { BoardImage } from "@/types/board";

export function StoryPhotoCredit({ image }: { image: BoardImage }) {
    if (!image.photographer) return null;
    return (
        <figcaption className="text-muted-foreground mt-2 max-w-full truncate text-[10px] leading-relaxed">
            {image.context ? (
                <span className="mb-1 block">Illustrative photo ? {image.context.locationLabel}</span>
            ) : null}
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
    thumbnail = false,
    frame = false,
    preservePortrait = false,
    portraitShape = "tall"
}: {
    image: BoardImage;
    onOpen: () => void;
    eager?: boolean;
    aspectRatio?: number;
    thumbnail?: boolean;
    frame?: boolean;
    preservePortrait?: boolean;
    portraitShape?: "tall" | "square";
}) {
    const [failed, setFailed] = useState(false);
    const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>();
    const width = image.width || naturalSize?.width;
    const height = image.height || naturalSize?.height;
    const ratio = width && height ? width / height : 4 / 3;
    const portrait =
        preservePortrait && ratio >= 0.1 && ratio < 0.9 && (!width || !height || Math.min(width, height) >= 32);
    const fillFrame = frame && !portrait;
    const displayRatio = portrait ? (portraitShape === "square" ? 1 : ratio) : aspectRatio || ratio;
    const crop =
        (frame || aspectRatio !== undefined) &&
        !(width && height && (Math.min(width, height) < 32 || ratio < 0.1 || ratio > 10));
    return (
        <figure
            className={`flex max-w-full shrink-0 cursor-pointer flex-col ${fillFrame ? "h-full min-h-0 w-full" : ""}`}
            style={{
                width: fillFrame
                    ? "100%"
                    : aspectRatio || portrait
                      ? thumbnail
                          ? "100%"
                          : `min(100cqw, calc((100cqh - 1.5rem) * ${displayRatio}))`
                      : `min(100%, ${image.width || 800}px)`
            }}
        >
            <button
                type="button"
                onClick={onOpen}
                aria-label={`Enlarge ${image.alt}`}
                className={`relative block w-full cursor-pointer overflow-hidden outline-offset-4 transition-transform hover:scale-[1.015] focus-visible:scale-[1.015] focus-visible:outline-2 motion-reduce:transform-none ${fillFrame ? "min-h-0 flex-1" : ""}`}
                style={{ aspectRatio: displayRatio }}
            >
                <span
                    aria-hidden="true"
                    className="border-foreground/25 dark:border-foreground/30 pointer-events-none absolute inset-0 z-10 border"
                />
                {failed ? (
                    <span className="text-muted-foreground p-4 text-xs">Saved photo unavailable</span>
                ) : (
                    <Image
                        src={image.url}
                        alt={image.alt}
                        fill
                        sizes={thumbnail ? "(max-width: 640px) 40vw, 192px" : "(max-width: 1024px) 80vw, 50vw"}
                        unoptimized
                        loading={eager ? "eager" : "lazy"}
                        onError={() => setFailed(true)}
                        onLoad={(event) => {
                            if (!image.width || !image.height)
                                setNaturalSize({
                                    width: event.currentTarget.naturalWidth,
                                    height: event.currentTarget.naturalHeight
                                });
                        }}
                        className={`pointer-events-none ${crop ? "object-cover" : "object-scale-down"}`}
                    />
                )}
            </button>
            {!thumbnail ? <StoryPhotoCredit image={image} /> : null}
        </figure>
    );
}
