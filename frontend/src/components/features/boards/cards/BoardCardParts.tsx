import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { BoardCardActions, BoardCardImage, BoardCardSummary } from "@/types/board-card";

export const cardAsset = (name: string) => `/images/board-cards/${name}`;

type FrameProps = {
    board: BoardCardSummary;
    width: number;
    height: number;
    children: ReactNode;
    className?: string;
    href?: string;
};

export function BoardCardFrame({ board, width, height, children, className = "", href }: FrameProps) {
    return (
        <article
            aria-label={`${board.title} — ${board.destination}`}
            className={`font-body @container relative isolate w-full ${className}`}
            style={{ aspectRatio: `${width} / ${height}` }}
        >
            {children}
            {href ? (
                <Link
                    href={href}
                    aria-label={`Open ${board.title}`}
                    className="focus-visible:outline-foreground absolute inset-0 z-10 focus-visible:outline-2 focus-visible:outline-offset-4"
                />
            ) : null}
        </article>
    );
}

export function BoardCardTitle({ board, className }: { board: BoardCardSummary; className: string }) {
    return (
        <h3 className={className} aria-label={board.title}>
            {board.titleLines
                ? board.titleLines.map((line, index) => (
                      <span key={`${index}-${line}`} className="block">
                          {line}
                      </span>
                  ))
                : board.title}
        </h3>
    );
}

export function BoardCardPhoto({
    image,
    className = "",
    sizes
}: {
    image: BoardCardImage;
    className?: string;
    sizes: string;
}) {
    return (
        <div className={`relative overflow-hidden ${className}`}>
            <div
                className="absolute inset-0"
                style={
                    image.crop
                        ? {
                              width: `${image.crop.width}%`,
                              height: `${image.crop.height}%`,
                              left: `${image.crop.left}%`,
                              top: `${image.crop.top}%`
                          }
                        : undefined
                }
            >
                <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes={sizes}
                    unoptimized={!image.src.startsWith("https://images.unsplash.com/")}
                    className="object-cover"
                    style={{ objectPosition: image.position ?? "center" }}
                />
            </div>
        </div>
    );
}

// Masks retain the exported Figma geometry while using the approved theme colors.
export function BoardCardGraphic({ asset, className }: { asset: string; className: string }) {
    return (
        <span
            aria-hidden="true"
            className={`pointer-events-none block ${className}`}
            style={{ maskImage: `url(${cardAsset(asset)})`, maskSize: "100% 100%", maskRepeat: "no-repeat" }}
        />
    );
}

type BookmarkProps = Pick<BoardCardActions, "bookmarked" | "onBookmark"> & {
    title: string;
    className: string;
    appearance: "collage" | "compact" | "landscape";
};

export function BoardCardBookmark({ title, bookmarked, onBookmark, className, appearance }: BookmarkProps) {
    const filled = bookmarked ?? (onBookmark ? false : appearance !== "landscape");
    const asset = filled
        ? appearance === "compact"
            ? "v2-tokyo-vector.svg"
            : "v1-tokyo-vector.svg"
        : "v3-buenos-aires-vector.svg";
    const icon = (
        <BoardCardGraphic
            asset={asset}
            className={`h-full w-full ${appearance === "compact" ? "bg-card-watermark" : "bg-card-title"}`}
        />
    );
    return (
        <div className={`absolute z-20 ${className}`}>
            {onBookmark ? (
                <button
                    type="button"
                    aria-label={`${filled ? "Unsave" : "Save"} ${title}`}
                    aria-pressed={filled}
                    onClick={onBookmark}
                    className="focus-visible:outline-foreground pointer-events-auto absolute top-1/2 left-1/2 grid min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 place-items-center focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                    <span className="absolute inset-0 m-auto h-[var(--bookmark-height)] w-[var(--bookmark-width)]">
                        {icon}
                    </span>
                </button>
            ) : (
                <span className="block h-full w-full">{icon}</span>
            )}
        </div>
    );
}

export function cardMeasure(value: number, reference: number): CSSProperties {
    return { width: `${(value / reference) * 100}cqw` };
}
