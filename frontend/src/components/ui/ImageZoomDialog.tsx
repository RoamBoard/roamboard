"use client";

import { useEffect, useRef, useState, useCallback, type CSSProperties } from "react";
import Image from "next/image";
import CroppedPhoto from "@/components/images/CroppedPhoto";
import { RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { ScrollArrow } from "./carousel";
import LibraryImage from "@/components/images/LibraryImage";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { creditLink } from "@/components/features/boards/BoardPhoto";
import type { BoardImage } from "@/types/board";

type Props = {
    images: BoardImage[];
    initialIndex?: number;
    onClose: () => void;
};

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.5;
const KEYBOARD_PAN_STEP = 50;

export default function ImageZoomDialog({ images, initialIndex = 0, onClose }: Props) {
    const dialogRef = useRef<HTMLDivElement>(null);
    useDialogFocus(dialogRef, onClose);

    const [currentIndex, setCurrentIndex] = useState(() => Math.max(0, Math.min(initialIndex, images.length - 1)));
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const hasMoved = useRef(false);
    const swipeStart = useRef<{ x: number; y: number } | null>(null);
    const [loadedLarge, setLoadedLarge] = useState<string | null>(null);
    const [failedDisplay, setFailedDisplay] = useState<string | null>(null);
    const [naturalSize, setNaturalSize] = useState({ url: "", width: 1, height: 1 });

    const currentImage = images[currentIndex] || images[0];
    const hasMultiple = images.length > 1;
    const largeUrl = currentImage?.largeUrl || currentImage?.url;

    useEffect(() => {
        if (!largeUrl || loadedLarge !== largeUrl || images.length < 2) return;
        const neighbours = [-1, 1].map((offset) => {
            const image = images[(currentIndex + offset + images.length) % images.length];
            const preload = new window.Image();
            preload.src = image.largeUrl || image.url;
            return preload;
        });
        return () =>
            neighbours.forEach((image) => {
                image.src = "";
            });
    }, [currentIndex, images, largeUrl, loadedLarge]);

    // Reset zoom and pan when switching to another image
    const handleSwitchImage = useCallback((newIndex: number) => {
        setScale(1);
        setPan({ x: 0, y: 0 });
        hasMoved.current = false;
        setCurrentIndex(newIndex);
    }, []);

    const goToPrev = useCallback(() => {
        if (!hasMultiple) return;
        handleSwitchImage((currentIndex - 1 + images.length) % images.length);
    }, [currentIndex, hasMultiple, images.length, handleSwitchImage]);

    const goToNext = useCallback(() => {
        if (!hasMultiple) return;
        handleSwitchImage((currentIndex + 1) % images.length);
    }, [currentIndex, hasMultiple, images.length, handleSwitchImage]);

    const zoomIn = useCallback(() => {
        setScale((current) => Math.min(ZOOM_MAX, Math.round((current + ZOOM_STEP) * 10) / 10));
    }, []);

    const zoomOut = useCallback(() => {
        setScale((current) => {
            const next = Math.max(ZOOM_MIN, Math.round((current - ZOOM_STEP) * 10) / 10);
            if (next === ZOOM_MIN) setPan({ x: 0, y: 0 });
            return next;
        });
    }, []);

    const resetZoom = useCallback(() => {
        setScale(1);
        setPan({ x: 0, y: 0 });
        hasMoved.current = false;
    }, []);

    const panBy = useCallback((dx: number, dy: number) => {
        setPan((current) => ({
            x: current.x + dx,
            y: current.y + dy
        }));
    }, []);

    const toggleZoom = useCallback(() => {
        setScale((current) => {
            if (current > 1) {
                setPan({ x: 0, y: 0 });
                return 1;
            }
            return 2;
        });
    }, []);

    // Pointer events for panning when zoomed in
    const handlePointerDown = (e: React.PointerEvent) => {
        hasMoved.current = false;
        if (scale <= 1) {
            if (e.pointerType === "touch") swipeStart.current = { x: e.clientX, y: e.clientY };
            return;
        }
        e.preventDefault();
        setIsDragging(true);
        dragStart.current = {
            x: e.clientX,
            y: e.clientY,
            panX: pan.x,
            panY: pan.y
        };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (swipeStart.current && Math.abs(e.clientX - swipeStart.current.x) > 8) hasMoved.current = true;
        if (!isDragging || scale <= 1) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            hasMoved.current = true;
        }
        setPan({
            x: dragStart.current.panX + dx,
            y: dragStart.current.panY + dy
        });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        const start = swipeStart.current;
        swipeStart.current = null;
        if (
            start &&
            scale <= 1 &&
            Math.abs(e.clientX - start.x) > 48 &&
            Math.abs(e.clientX - start.x) > Math.abs(e.clientY - start.y)
        ) {
            if (e.clientX > start.x) goToPrev();
            else goToNext();
            hasMoved.current = true;
        }
        if (isDragging) {
            setIsDragging(false);
            try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {
                // Ignore if pointer capture was already lost
            }
        }
    };

    const handlePointerCancel = (e: React.PointerEvent) => {
        swipeStart.current = null;
        if (isDragging) {
            setIsDragging(false);
            try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {
                // Ignore if pointer capture was already lost
            }
        }
    };

    const handleImageClick = () => {
        if (hasMoved.current) return;
        toggleZoom();
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        if (e.deltaY < 0) {
            zoomIn();
        } else if (e.deltaY > 0) {
            zoomOut();
        }
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (scale > 1) {
                if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
                    event.preventDefault();
                    panBy(0, KEYBOARD_PAN_STEP);
                    return;
                }
                if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
                    event.preventDefault();
                    panBy(0, -KEYBOARD_PAN_STEP);
                    return;
                }
                if (
                    event.key === "a" ||
                    event.key === "A" ||
                    (event.shiftKey && event.key === "ArrowLeft") ||
                    (!hasMultiple && event.key === "ArrowLeft")
                ) {
                    event.preventDefault();
                    panBy(KEYBOARD_PAN_STEP, 0);
                    return;
                }
                if (
                    event.key === "d" ||
                    event.key === "D" ||
                    (event.shiftKey && event.key === "ArrowRight") ||
                    (!hasMultiple && event.key === "ArrowRight")
                ) {
                    event.preventDefault();
                    panBy(-KEYBOARD_PAN_STEP, 0);
                    return;
                }
            }

            if (event.key === "ArrowLeft") {
                event.preventDefault();
                goToPrev();
            } else if (event.key === "ArrowRight") {
                event.preventDefault();
                goToNext();
            } else if (event.key === "+" || event.key === "=") {
                event.preventDefault();
                zoomIn();
            } else if (event.key === "-" || event.key === "_") {
                event.preventDefault();
                zoomOut();
            } else if (event.key === "0") {
                event.preventDefault();
                resetZoom();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [goToPrev, goToNext, zoomIn, zoomOut, resetZoom, panBy, scale, hasMultiple]);

    // Prevent background scrolling while open
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    if (!currentImage) return null;

    const isLibrary = currentImage.url.startsWith("library:");
    const Photo = isLibrary ? LibraryImage : Image;
    const width = naturalSize.url === currentImage.url ? naturalSize.width : currentImage.width || 1;
    const height = naturalSize.url === currentImage.url ? naturalSize.height : currentImage.height || 1;
    const aspect =
        (width * (currentImage.presentation?.width ?? 1)) / (height * (currentImage.presentation?.height ?? 1));

    return (
        <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Enlarged photo view"
            tabIndex={-1}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-black/75 text-white outline-none select-none"
            onClick={(e) => {
                if (!(e.target as Element).closest("button, a, main")) {
                    onClose();
                }
            }}
        >
            {/* Top Toolbar */}
            <header className="z-10 flex w-full items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-4 py-3 sm:px-6 sm:py-4">
                <div className="flex min-w-0 items-center gap-3">
                    {hasMultiple && (
                        <span className="text-12 rounded-[2px] bg-white/10 px-2.5 py-1 font-mono tracking-wider text-white/90">
                            {`${currentIndex + 1} / ${images.length}`}
                        </span>
                    )}
                    <span className="text-14 max-w-xs truncate font-medium text-white/80 sm:max-w-md">
                        {currentImage.alt || "Photo"}
                    </span>
                </div>

                <div className="flex items-center gap-1 sm:gap-2">
                    <span className="text-12 hidden rounded-[2px] px-2 py-1 font-mono text-white/60 sm:inline-block">
                        {`${Math.round(scale * 100)}%`}
                    </span>
                    <button
                        type="button"
                        onClick={zoomIn}
                        disabled={scale >= ZOOM_MAX}
                        aria-label="Zoom in"
                        className="flex size-9 cursor-pointer items-center justify-center rounded-[2px] border border-white/10 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <ZoomIn size={18} strokeWidth={1.5} />
                    </button>
                    <button
                        type="button"
                        onClick={zoomOut}
                        disabled={scale <= ZOOM_MIN}
                        aria-label="Zoom out"
                        className="flex size-9 cursor-pointer items-center justify-center rounded-[2px] border border-white/10 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <ZoomOut size={18} strokeWidth={1.5} />
                    </button>
                    {scale > 1 && (
                        <button
                            type="button"
                            onClick={resetZoom}
                            aria-label="Reset zoom"
                            className="flex size-9 cursor-pointer items-center justify-center rounded-[2px] border border-white/10 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                        >
                            <RotateCcw size={16} strokeWidth={1.5} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close enlarged view"
                        className="ml-2 flex size-9 cursor-pointer items-center justify-center rounded-[2px] border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
                    >
                        <X size={18} strokeWidth={1.5} />
                    </button>
                </div>
            </header>

            {/* Main Image Stage */}
            <main
                className="relative flex w-full flex-1 touch-none items-center justify-center overflow-hidden p-2 sm:p-6"
                style={{ "--photo-width": `min(calc(76dvh * ${aspect}), calc(100vw - 8rem))` } as CSSProperties}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onWheel={handleWheel}
                onClick={(event) => {
                    if (hasMoved.current) return;
                    if (event.target === event.currentTarget) onClose();
                    else handleImageClick();
                }}
            >
                <div
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        transformOrigin: "center center",
                        width: "var(--photo-width)",
                        aspectRatio: aspect
                    }}
                    className={`relative flex shrink-0 items-center justify-center ${scale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"} ${
                        isDragging
                            ? "motion-reduce:transition-none"
                            : "motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none"
                    }`}
                >
                    {currentImage.presentation ? (
                        <CroppedPhoto
                            src={currentImage.url}
                            alt={currentImage.alt}
                            width={currentImage.width}
                            height={currentImage.height}
                            presentation={currentImage.presentation}
                            onError={() => setFailedDisplay(currentImage.url)}
                            onLoad={(event) =>
                                setNaturalSize({
                                    url: currentImage.url,
                                    width: event.currentTarget.naturalWidth,
                                    height: event.currentTarget.naturalHeight
                                })
                            }
                            className="max-h-full w-full max-w-full"
                        />
                    ) : (
                        <Photo
                            key={currentImage.url}
                            src={currentImage.url}
                            alt={currentImage.alt}
                            fill
                            sizes="95vw"
                            priority
                            className="pointer-events-none object-contain select-none"
                            style={{ opacity: largeUrl !== currentImage.url && loadedLarge === largeUrl ? 0 : 1 }}
                            onLoad={(event) => {
                                setNaturalSize({
                                    url: currentImage.url,
                                    width: event.currentTarget.naturalWidth,
                                    height: event.currentTarget.naturalHeight
                                });
                                if (largeUrl === currentImage.url) setLoadedLarge(largeUrl);
                            }}
                            onError={() => setFailedDisplay(currentImage.url)}
                            unoptimized
                        />
                    )}
                    {!currentImage.presentation && largeUrl && largeUrl !== currentImage.url ? (
                        <Photo
                            key={largeUrl}
                            src={largeUrl}
                            alt={currentImage.alt}
                            fill
                            sizes="95vw"
                            priority
                            unoptimized
                            className="pointer-events-none object-contain select-none"
                            style={{ opacity: loadedLarge === largeUrl ? 1 : 0 }}
                            onLoad={() => setLoadedLarge(largeUrl)}
                            onError={() => setLoadedLarge(null)}
                        />
                    ) : null}
                    {failedDisplay === currentImage.url && loadedLarge !== largeUrl ? (
                        <p role="status" className="text-sm text-white/70">
                            This photo is unavailable.
                        </p>
                    ) : null}
                </div>

                {/* Left/Right Carousel Controls */}
                {hasMultiple && (
                    <>
                        <ScrollArrow
                            direction="previous"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                goToPrev();
                            }}
                            aria-label="Previous photo"
                            className="absolute top-1/2 z-20 -translate-y-1/2"
                            style={{
                                left: `clamp(8px, calc(50% + ${pan.x}px - var(--photo-width) * ${scale / 2} - 56px), calc(100% - 52px))`
                            }}
                        />
                        <ScrollArrow
                            direction="next"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                goToNext();
                            }}
                            aria-label="Next photo"
                            className="absolute top-1/2 z-20 -translate-y-1/2"
                            style={{
                                right: `clamp(8px, calc(50% - ${pan.x}px - var(--photo-width) * ${scale / 2} - 56px), calc(100% - 52px))`
                            }}
                        />
                    </>
                )}
            </main>

            {/* Bottom Caption & Photographer Attribution */}
            {currentImage.photographer ? (
                <footer className="z-10 flex w-full justify-center bg-gradient-to-t from-black/80 to-transparent px-4 pt-2 pb-4">
                    <p className="text-12 rounded-[2px] bg-black/60 px-4 py-1.5 text-white/80 backdrop-blur-xs">
                        {currentImage.context ? (
                            <span className="mb-1 block text-center">
                                Illustrative photo ? {currentImage.context.locationLabel}
                            </span>
                        ) : null}
                        Photo by{" "}
                        {currentImage.photographerUrl ? (
                            <a
                                href={creditLink(currentImage.photographerUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="underline underline-offset-2 hover:text-white"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {currentImage.photographer}
                            </a>
                        ) : (
                            <span className="text-white">{currentImage.photographer}</span>
                        )}
                        {currentImage.sourceUrl ? (
                            <>
                                {" "}
                                on{" "}
                                <a
                                    href={creditLink(currentImage.sourceUrl)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline underline-offset-2 hover:text-white"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Unsplash
                                </a>
                            </>
                        ) : null}
                    </p>
                </footer>
            ) : (
                <div className="h-4" />
            )}
        </div>
    );
}
