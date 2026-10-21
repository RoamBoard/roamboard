"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
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

export default function ImageZoomDialog({ images, initialIndex = 0, onClose }: Props) {
    const dialogRef = useRef<HTMLDivElement>(null);
    useDialogFocus(dialogRef, onClose);

    const [currentIndex, setCurrentIndex] = useState(() => Math.max(0, Math.min(initialIndex, images.length - 1)));
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const hasMoved = useRef(false);

    const currentImage = images[currentIndex] || images[0];
    const hasMultiple = images.length > 1;

    // Reset zoom and pan when switching to another image
    const handleSwitchImage = useCallback((newIndex: number) => {
        setScale(1);
        setPan({ x: 0, y: 0 });
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
        if (scale <= 1) return;
        e.preventDefault();
        setIsDragging(true);
        hasMoved.current = false;
        dragStart.current = {
            x: e.clientX,
            y: e.clientY,
            panX: pan.x,
            panY: pan.y
        };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
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
    }, [goToPrev, goToNext, zoomIn, zoomOut, resetZoom]);

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

    return (
        <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Enlarged photo view"
            tabIndex={-1}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-black/92 text-white backdrop-blur-md outline-none select-none"
            onClick={(e) => {
                if (e.target === e.currentTarget && !hasMoved.current) {
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
                className={`relative flex w-full flex-1 items-center justify-center overflow-hidden p-2 sm:p-6 ${
                    scale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
                }`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onWheel={handleWheel}
                onClick={handleImageClick}
            >
                <div
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        transformOrigin: "center center"
                    }}
                    className={`relative flex h-[76dvh] max-h-[82vh] w-[92vw] max-w-[90vw] items-center justify-center ${
                        isDragging ? "" : "transition-transform duration-200 ease-out"
                    }`}
                >
                    <Photo
                        src={currentImage.url}
                        alt={currentImage.alt}
                        fill
                        sizes="95vw"
                        priority
                        className="pointer-events-none object-contain select-none"
                        unoptimized
                    />
                </div>

                {/* Left/Right Carousel Controls */}
                {hasMultiple && (
                    <>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                goToPrev();
                            }}
                            aria-label="Previous photo"
                            className="absolute top-1/2 left-3 z-20 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/90 shadow-xl backdrop-blur-sm transition-all hover:scale-105 hover:bg-black/85 hover:text-white focus-visible:outline-2 focus-visible:outline-white sm:left-6"
                        >
                            <ChevronLeft size={24} strokeWidth={2} />
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                goToNext();
                            }}
                            aria-label="Next photo"
                            className="absolute top-1/2 right-3 z-20 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/90 shadow-xl backdrop-blur-sm transition-all hover:scale-105 hover:bg-black/85 hover:text-white focus-visible:outline-2 focus-visible:outline-white sm:right-6"
                        >
                            <ChevronRight size={24} strokeWidth={2} />
                        </button>
                    </>
                )}
            </main>

            {/* Bottom Caption & Photographer Attribution */}
            {currentImage.photographer ? (
                <footer className="z-10 flex w-full justify-center bg-gradient-to-t from-black/80 to-transparent px-4 pt-2 pb-4">
                    <p className="text-12 rounded-[2px] bg-black/60 px-4 py-1.5 text-white/80 backdrop-blur-xs">
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
