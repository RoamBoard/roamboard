"use client";

import Image from "next/image";
import { useState } from "react";
import type { BoardImage } from "@/types/board";

export function StoryPhotoCredit({ image }: { image: BoardImage }) {
    if (!image.photographer) return null;
    return (
        <figcaption className="text-muted-foreground mt-2 max-w-full text-[10px] leading-relaxed">
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

// Bounded frames reserve space; the photograph itself is always contained and never stretched.
export default function StoryPhoto({
    image,
    onOpen,
    eager = false
}: {
    image: BoardImage;
    onOpen: () => void;
    eager?: boolean;
}) {
    const [failed, setFailed] = useState(false);
    const ratio = image.width && image.height ? image.width / image.height : 4 / 3;
    return (
        <figure
            className="flex max-w-full shrink-0 flex-col justify-center"
            style={{ width: `clamp(8rem, ${Math.min(84, Math.max(14, ratio * 48))}vh, 48rem)` }}
        >
            <button
                type="button"
                onClick={onOpen}
                aria-label={`Enlarge ${image.alt}`}
                className="bg-faint/30 relative flex h-[48vh] max-h-[34rem] w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-sm outline-offset-4 transition-transform hover:scale-[1.015] focus-visible:outline-2 motion-reduce:transform-none"
            >
                {failed ? (
                    <span className="text-muted-foreground p-4 text-xs">Saved photo unavailable</span>
                ) : (
                    <Image
                        src={image.url}
                        alt={image.alt}
                        width={image.width || 1200}
                        height={image.height || 900}
                        unoptimized
                        loading={eager ? "eager" : "lazy"}
                        onError={() => setFailed(true)}
                        className="h-auto max-h-full w-auto max-w-full object-scale-down"
                        style={{
                            maxWidth: image.width ? `min(100%, ${image.width}px)` : "100%",
                            maxHeight: image.height ? `min(100%, ${image.height}px)` : "100%"
                        }}
                    />
                )}
            </button>
            <StoryPhotoCredit image={image} />
        </figure>
    );
}
