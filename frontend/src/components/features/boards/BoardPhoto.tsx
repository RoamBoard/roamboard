"use client";

import Image from "next/image";
import LibraryImage from "@/components/images/LibraryImage";
import { useState } from "react";
import type { BoardImage } from "@/types/board";

type Props = {
    image?: BoardImage;
    className?: string;
    sizes?: string;
    preload?: boolean;
    placeholderLabel?: string;
    showCredit?: boolean;
    insetCredit?: boolean;
};

// Unsplash credit links include referral parameters; photo URLs themselves are loaded as returned.
// https://help.unsplash.com/en/articles/2511315-guideline-attribution
function creditLink(value: string) {
    try {
        const url = new URL(value);
        if (url.protocol !== "https:" || !["unsplash.com", "www.unsplash.com"].includes(url.hostname)) return undefined;
        url.searchParams.set("utm_source", "roamboard");
        url.searchParams.set("utm_medium", "referral");
        return url.toString();
    } catch {
        return undefined;
    }
}

// Use the same image setup for covers, activity photos, and author photos.
export default function BoardPhoto({
    image,
    className = "",
    sizes = "(max-width: 768px) 75vw, 30vw",
    preload = false,
    placeholderLabel,
    showCredit = false,
    insetCredit = false
}: Props) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const Photo = image?.url.startsWith("library:") ? LibraryImage : Image;
    if (!image?.url || failedUrl === image.url) {
        if (!placeholderLabel) return null;
        return (
            <div
                role="img"
                aria-label={`Photo unavailable for ${placeholderLabel}`}
                className={`bg-faint text-muted-foreground relative overflow-hidden ${className}`}
            >
                <div className="absolute inset-0 grid place-items-center p-5 text-center">
                    <span className="text-12 max-w-full break-words">
                        {placeholderLabel}
                        {image?.source === "upload" && failedUrl === image.url ? " — saved image unavailable" : ""}
                    </span>
                </div>
            </div>
        );
    }

    return (
        // The wrapper sets the size; fill makes the image fit inside it.
        <div className={`relative overflow-hidden ${className}`}>
            <Photo
                src={image.url}
                alt={image.alt}
                fill
                sizes={sizes}
                preload={preload}
                className="object-cover"
                onError={() => setFailedUrl(image.url)}
                // Fetch protected API images directly so the browser sends its session cookie.
                unoptimized
            />
            {showCredit && image.photographer ? (
                <p
                    className={`text-10 absolute z-10 bg-black/60 px-3 py-2 text-white ${
                        insetCredit
                            ? "bottom-[18%] left-1/2 w-max max-w-[70%] -translate-x-1/2 text-center"
                            : "inset-x-0 bottom-0"
                    }`}
                >
                    Photo by{" "}
                    {image.photographerUrl ? (
                        <a
                            href={creditLink(image.photographerUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-2"
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
                            <a
                                href={creditLink(image.sourceUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="underline underline-offset-2"
                            >
                                Unsplash
                            </a>
                        </>
                    ) : null}
                </p>
            ) : null}
        </div>
    );
}
