/* eslint-disable @next/next/no-img-element */
"use client";
import { useState, type ImgHTMLAttributes } from "react";
import type { PhotoEdit } from "@/lib/photo-editing";

export default function CroppedPhoto({
    presentation,
    thumbnail = false,
    alt = "",
    width,
    height,
    className,
    ...props
}: ImgHTMLAttributes<HTMLImageElement> & { presentation?: PhotoEdit | null; thumbnail?: boolean }) {
    const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
    if (!presentation) return <img {...props} alt={alt} width={width} height={height} className={className} />;
    const resized =
        typeof props.src === "string" && props.src.startsWith("https://images.unsplash.com/")
            ? new URL(props.src)
            : null;
    if (resized) {
        resized.searchParams.set(
            "w",
            String(Math.min(thumbnail ? 640 : 4096, Math.ceil(presentation.outputWidth / presentation.width)))
        );
        resized.searchParams.set(
            "h",
            String(Math.min(thumbnail ? 640 : 4096, Math.ceil(presentation.outputHeight / presentation.height)))
        );
        resized.searchParams.set("fit", "max");
    }
    const aspect =
        (((natural?.width ?? Number(width)) || 1) * presentation.width) /
        (((natural?.height ?? Number(height)) || 1) * presentation.height);
    return (
        <span className={`relative block overflow-hidden ${className ?? ""}`} style={{ aspectRatio: aspect }}>
            <img
                {...props}
                alt={alt}
                src={resized?.toString() ?? props.src}
                className="absolute max-w-none"
                onLoad={(event) => {
                    setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
                    props.onLoad?.(event);
                }}
                style={{
                    width: `${100 / presentation.width}%`,
                    height: `${100 / presentation.height}%`,
                    left: `${(-100 * presentation.x) / presentation.width}%`,
                    top: `${(-100 * presentation.y) / presentation.height}%`
                }}
            />
        </span>
    );
}
