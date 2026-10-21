"use client";

import Image from "next/image";
import LibraryImage from "@/components/images/LibraryImage";
import { useState } from "react";
import { Maximize2 } from "lucide-react";
import ImageZoomDialog from "@/components/ui/ImageZoomDialog";
import type { BoardImage } from "@/types/board";

type Props = {
    image?: BoardImage;
    className?: string;
    sizes?: string;
    preload?: boolean;
    placeholderLabel?: string;
    showCredit?: boolean;
    insetCredit?: boolean;
    zoomable?: boolean;
    onZoom?: () => void;
};

// Unsplash credit links include referral parameters; photo URLs themselves are loaded as returned.
// https://help.unsplash.com/en/articles/2511315-guideline-attribution
export function creditLink(value: string) {
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
    insetCredit = false,
    zoomable = false,
    onZoom
}: Props) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const [isZoomed, setIsZoomed] = useState(false);
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

    const handleZoomClick = () => {
        if (onZoom) {
            onZoom();
        } else {
            setIsZoomed(true);
        }
    };

    const creditElement =
        showCredit && image.photographer ? (
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
                        onClick={(e) => e.stopPropagation()}
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
                            onClick={(e) => e.stopPropagation()}
                        >
                            Unsplash
                        </a>
                    </>
                ) : null}
            </p>
        ) : null;

    if (zoomable) {
        return (
            <>
                <div
                    role="button"
                    tabIndex={0}
                    onClick={handleZoomClick}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleZoomClick();
                        }
                    }}
                    aria-label={`Enlarge photo: ${image.alt || placeholderLabel || "Photo"}`}
                    className={`group/photo relative block cursor-zoom-in overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
                >
                    <Photo
                        src={image.url}
                        alt={image.alt}
                        fill
                        sizes={sizes}
                        preload={preload}
                        className="object-cover transition-transform duration-300 ease-out group-hover/photo:scale-103 motion-reduce:transition-none motion-reduce:group-hover/photo:transform-none"
                        onError={() => setFailedUrl(image.url)}
                        unoptimized
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover/photo:bg-black/20">
                        <span className="text-10 flex items-center gap-1 rounded-[2px] bg-black/60 px-2 py-1 font-medium text-white opacity-0 shadow backdrop-blur-xs transition-opacity duration-200 group-hover/photo:opacity-100">
                            <Maximize2 className="size-3" />
                        </span>
                    </div>
                    {creditElement}
                </div>
                {isZoomed && !onZoom && <ImageZoomDialog images={[image]} onClose={() => setIsZoomed(false)} />}
            </>
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
            {creditElement}
        </div>
    );
}
