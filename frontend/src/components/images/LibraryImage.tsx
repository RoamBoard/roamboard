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

export const ImageCatalogContext = createContext<LibraryRecord[]>([]);
export const ImageDeliveryContext = createContext<{
    failed: ReadonlySet<string>;
    markFailed: (identity: string) => void;
}>({ failed: new Set(), markFailed: () => {} });

const deliveryIdentity = (image: LibraryRecord) => JSON.stringify([image.assetKey, image.revision, image.asset.url]);

export function ImageLibraryProvider({ children }: { children: ReactNode }) {
    const [images, setImages] = useState<LibraryRecord[]>([]);
    const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
    const markFailed = (identity: string) => {
        setFailed((previous) => (previous.has(identity) ? previous : new Set([...previous, identity])));
    };
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
    return (
        <ImageCatalogContext.Provider value={images}>
            <ImageDeliveryContext.Provider value={{ failed, markFailed }}>{children}</ImageDeliveryContext.Provider>
        </ImageCatalogContext.Provider>
    );
}

export function useLibraryImage(source: string) {
    return findLibraryImage(useContext(ImageCatalogContext), source);
}

function useSource(original: string, sourceWidth?: number) {
    const image = useLibraryImage(original);
    const delivery = useContext(ImageDeliveryContext);
    const originalFallback = editorialFallback(original) ?? original;
    const fallbackSource = librarySource(undefined, originalFallback, sourceWidth);
    const selected = librarySource(image, originalFallback, sourceWidth);
    const attempt = JSON.stringify([selected, image ? deliveryIdentity(image) : null]);
    const [failed, setFailed] = useState<string | null>(null);
    const usingFallback = failed === attempt || (image && delivery.failed.has(deliveryIdentity(image)));
    const source = usingFallback ? fallbackSource : selected;
    return {
        source,
        image: usingFallback ? undefined : image,
        fallback: () => {
            if (source !== fallbackSource) {
                setFailed(attempt);
                if (image) delivery.markFailed(deliveryIdentity(image));
                return true;
            }
            return false;
        }
    };
}

export default function LibraryImage({ src, onError, sourceWidth, ...props }: ImageProps & { sourceWidth?: number }) {
    const { source, image, fallback } = useSource(typeof src === "string" ? src : "", sourceWidth);
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
    const delivery = useContext(ImageDeliveryContext);
    if (
        !image ||
        delivery.failed.has(deliveryIdentity(image)) ||
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
