"use client";

import Image, { type ImageProps } from "next/image";
import { createContext, useContext, useEffect, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import {
    findLibraryImage,
    libraryRequest,
    librarySource,
    editorialFallback,
    type LibraryImage as LibraryRecord
} from "@/lib/image-library";

const Catalog = createContext<LibraryRecord[]>([]);

export function ImageLibraryProvider({ children }: { children: ReactNode }) {
    const [images, setImages] = useState<LibraryRecord[]>([]);
    useEffect(() => {
        const controller = new AbortController();
        const refresh = () => {
            void libraryRequest<LibraryRecord[]>("", { signal: controller.signal })
                .then(setImages)
                .catch(() => {
                    // Retain original sources (or the last successful catalog) during outages.
                });
        };
        refresh();
        window.addEventListener("image-library-updated", refresh);
        return () => {
            controller.abort();
            window.removeEventListener("image-library-updated", refresh);
        };
    }, []);
    return <Catalog.Provider value={images}>{children}</Catalog.Provider>;
}

export function useLibraryImage(source: string) {
    return findLibraryImage(useContext(Catalog), source);
}

function useSource(original: string) {
    const image = useLibraryImage(original);
    const fallbackSource = editorialFallback(original) ?? original;
    const selected = librarySource(image, fallbackSource);
    const [failed, setFailed] = useState<string | null>(null);
    const source = failed === selected ? fallbackSource : selected;
    return {
        source,
        image,
        fallback: () => {
            if (source !== fallbackSource) {
                setFailed(selected);
                return true;
            }
            return false;
        }
    };
}

export default function LibraryImage({ src, onError, ...props }: ImageProps) {
    const { source, image, fallback } = useSource(typeof src === "string" ? src : "");
    if (typeof src === "string" && source.startsWith("library:")) {
        return <span role="img" aria-label={`${props.alt} — image unavailable`} className={props.className} />;
    }
    return (
        <Image
            {...props}
            alt={props.alt}
            src={typeof src === "string" ? source : src}
            title={
                image ? `${image.asset.credit}${image.asset.provider === "unsplash" ? " / Unsplash" : ""}` : props.title
            }
            onError={(event) => {
                if (!fallback()) onError?.(event);
            }}
        />
    );
}

export function LibraryImg({ src, onError, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
    const { source, image, fallback } = useSource(typeof src === "string" ? src : "");
    if (source.startsWith("library:"))
        return (
            <span role="img" aria-label={`${props.alt ?? "Image"} — image unavailable`} className={props.className} />
        );
    // Native rendering keeps cookie-authenticated Board images and blob upload previews unchanged.
    return (
        // eslint-disable-next-line @next/next/no-img-element -- Preserve native previews and cookie-authenticated image behavior.
        <img
            src={typeof src === "string" ? source : src}
            {...props}
            alt={props.alt ?? ""}
            title={image ? image.asset.credit : props.title}
            onError={(event) => {
                if (!fallback()) onError?.(event);
            }}
        />
    );
}

export function LibraryCredit({
    source,
    children,
    className
}: {
    source: string;
    children?: ReactNode;
    className?: string;
}) {
    const image = useLibraryImage(source);
    if (
        !image ||
        (children && image.revision === 1) ||
        image.asset.credit.startsWith("Existing Roamboard frontend asset")
    )
        return <>{children}</>;
    return image.asset.provider === "unsplash" ? (
        <span className={className}>
            Photo by{" "}
            <a
                className="underline"
                href={image.asset.photographerUrl || image.asset.sourceUrl}
                target="_blank"
                rel="noreferrer"
            >
                {image.asset.credit}
            </a>{" "}
            on{" "}
            <a className="underline" href={image.asset.sourceUrl} target="_blank" rel="noreferrer">
                Unsplash
            </a>
        </span>
    ) : (
        <span className={className}>
            {image.asset.sourceUrl ? (
                <a className="underline" href={image.asset.sourceUrl} target="_blank" rel="noreferrer">
                    {image.asset.credit}
                </a>
            ) : (
                image.asset.credit
            )}
        </span>
    );
}
