"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import Image, { LibraryCredit } from "@/components/images/LibraryImage";
import { getDestinationPage, type AtlasImage } from "@/data/destination-atlas";
import { getDiscoverDestination } from "@/data/discover-destinations";
import type { DestinationLoadingState } from "@/lib/destination-loading";

// Deliberate, asymmetric geometry. Transforms draw each rule from its own edge.
const lines = [
    { axis: "x", left: "0%", top: "15.2%", width: "66%", origin: "left", delay: 0.38 },
    { axis: "y", left: "63%", top: "0%", height: "85%", origin: "top", delay: 0.58 },
    { axis: "x", right: "0%", top: "40.5%", width: "86%", origin: "right", delay: 0.78 },
    { axis: "y", left: "38.8%", top: "15.2%", height: "34%", origin: "bottom", delay: 1.02 },
    { axis: "x", left: "0%", top: "75.3%", width: "100%", origin: "left", delay: 1.24 },
    { axis: "y", left: "81%", top: "33.5%", height: "67%", origin: "bottom", delay: 1.4 },
    { axis: "x", right: "37%", top: "57.8%", width: "63%", origin: "right", delay: 1.56 },
    { axis: "x", left: "2.5%", top: "92.4%", width: "61%", origin: "left", delay: 1.72 }
] as const;
const mobileLines = [
    { axis: "x", left: "0%", top: "19%", width: "72%", origin: "left", delay: 0.38 },
    { axis: "y", left: "61%", top: "0%", height: "92%", origin: "top", delay: 0.58 },
    { axis: "x", right: "0%", top: "41%", width: "95%", origin: "right", delay: 0.78 },
    { axis: "y", left: "52%", top: "19%", height: "36%", origin: "top", delay: 1.02 },
    { axis: "x", left: "0%", top: "89%", width: "100%", origin: "left", delay: 1.24 }
] as const;

function destinationPhotos(href: string | null): AtlasImage[] {
    if (!href) return [];
    const slug = decodeURIComponent(href.split("?")[0].split("/").at(-1) ?? "");
    // A namesake must never borrow the primary editorial destination's photographs.
    if (href.includes("?")) return [];
    const guide = getDestinationPage(slug);
    // Atlas hero/closing artwork can already include a circular mask. The place
    // photographs are uncropped sources and fit the architectural windows.
    if (guide)
        return [
            guide.places[0]?.image ?? guide.hero,
            guide.places[1]?.image ?? guide.hero,
            guide.places.at(-1)?.image ?? guide.closingImage
        ];
    const country = getDiscoverDestination(slug);
    if (!country) return [];
    return [
        {
            src: country.coverImage.src,
            alt: country.coverImage.alt,
            credit: country.coverImage.photographer ?? "Destination photography",
            sourceUrl: country.coverImage.sourceUrl
        }
    ];
}

function EmergingPhoto({ photo, index }: { photo: AtlasImage; index: number }) {
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    const positions = [
        "top-[15.2%] left-[14%] h-[25.3%] w-[24.8%] max-md:top-[19%] max-md:left-[5%] max-md:h-[22%] max-md:w-[47%]",
        "top-[40.5%] left-[63%] h-[34.8%] w-[18%] max-md:top-[65%] max-md:left-[61%] max-md:h-[24%] max-md:w-[34%]",
        "top-[75.3%] left-[2.5%] h-[17.1%] w-[27%] max-md:hidden"
    ];
    return (
        <motion.figure
            className={`absolute overflow-hidden ${positions[index]}`}
            initial={{ opacity: 0, scale: 1.035 }}
            animate={{ opacity: loaded && !failed ? 0.48 : 0, scale: loaded ? 1 : 1.035 }}
            transition={{ duration: 1.25, delay: 0.9 + index * 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
            <Image
                src={photo.src}
                alt=""
                fill
                sizes="(max-width: 767px) 45vw, 28vw"
                loading="eager"
                className="object-cover blur-[2px] saturate-75"
                style={{ objectPosition: photo.position }}
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
            />
        </motion.figure>
    );
}

export default function DestinationLoading({
    state,
    reduced,
    mobile,
    onCancel,
    onRetry,
    onRevealed
}: {
    state: DestinationLoadingState;
    reduced: boolean;
    mobile: boolean;
    onCancel: () => void;
    onRetry: () => void;
    onRevealed: () => void;
}) {
    const dialog = useRef<HTMLDivElement>(null);
    const photos = reduced ? [] : destinationPhotos(state.href).slice(0, mobile ? 2 : 3);
    const revealing = state.phase === "revealing";

    useEffect(() => {
        if (state.phase !== "error") dialog.current?.focus({ preventScroll: true });
    }, [state.phase]);

    return (
        <motion.div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label={`Opening ${state.name}`}
            tabIndex={-1}
            className="font-body text-foreground fixed inset-0 z-[60] outline-none"
            initial={{ opacity: 1 }}
            animate={{ opacity: revealing ? 0 : 1 }}
            transition={{ duration: reduced ? 0 : 0.65, ease: [0.4, 0, 0.2, 1] }}
            onAnimationComplete={() => {
                if (revealing) onRevealed();
            }}
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    onCancel();
                }
                if (event.key === "Tab") {
                    const controls = Array.from(
                        event.currentTarget.querySelectorAll<HTMLElement>("button, summary, details[open] a")
                    );
                    if (
                        event.shiftKey &&
                        (document.activeElement === controls[0] || document.activeElement === event.currentTarget)
                    ) {
                        event.preventDefault();
                        controls.at(-1)?.focus();
                    } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
                        event.preventDefault();
                        controls[0]?.focus();
                    }
                }
            }}
        >
            <motion.div
                aria-hidden="true"
                className="bg-background/45 absolute inset-y-0 left-0 w-16 backdrop-blur-[3px] md:w-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduced ? 0 : 0.6 }}
            />
            <div className="bg-background absolute inset-y-0 right-0 left-16 isolate overflow-hidden md:left-20">
                {!reduced && (
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                        {photos.map((photo, index) => (
                            <EmergingPhoto key={photo.src} photo={photo} index={index} />
                        ))}
                        {(mobile ? mobileLines : lines).map(({ axis, origin, delay, ...position }, index) => (
                            <motion.div
                                key={index}
                                className="absolute"
                                style={{
                                    ...position,
                                    transformOrigin: origin,
                                    width: axis === "y" ? 1 : "width" in position ? position.width : undefined,
                                    height: axis === "x" ? 1 : "height" in position ? position.height : undefined
                                }}
                                initial={axis === "x" ? { scaleX: 0 } : { scaleY: 0 }}
                                animate={axis === "x" ? { scaleX: 1 } : { scaleY: 1 }}
                                transition={{ duration: 1.15, delay, ease: [0.22, 1, 0.36, 1] }}
                            >
                                <motion.div
                                    className="bg-muted-foreground/35 size-full"
                                    animate={
                                        axis === "x" ? { x: [0, index % 2 ? -8 : 8] } : { y: [0, index % 2 ? 8 : -8] }
                                    }
                                    transition={{
                                        delay: 3,
                                        duration: 18 + index * 2,
                                        repeat: Infinity,
                                        repeatType: "mirror",
                                        ease: "easeInOut"
                                    }}
                                />
                            </motion.div>
                        ))}
                    </div>
                )}
                <div className="absolute inset-0 grid place-items-center px-6">
                    <div className="relative max-w-full text-center">
                        <motion.p
                            className="text-foreground text-20 break-words"
                            initial={{ fontWeight: 400 }}
                            animate={{ fontWeight: 650 }}
                            transition={{ duration: reduced ? 0 : 0.65 }}
                        >
                            {state.name.toLocaleLowerCase()}
                        </motion.p>
                        {state.phase === "error" && (
                            <div className="bg-background/90 text-muted-foreground absolute top-full left-1/2 mt-6 w-[min(19rem,65vw)] -translate-x-1/2 px-4 pb-2 text-sm leading-relaxed">
                                <p role="alert">{state.error}</p>
                                <button
                                    autoFocus
                                    type="button"
                                    onClick={onRetry}
                                    className="text-foreground mt-3 min-h-11 underline underline-offset-4 focus-visible:outline-2"
                                >
                                    Try again
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <p role="status" className="sr-only">
                    {state.phase === "error" ? "Destination loading failed." : `Preparing ${state.name}.`}
                </p>
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-muted-foreground hover:text-foreground bg-background/80 focus-visible:outline-foreground absolute top-4 right-4 z-10 min-h-11 rounded-sm px-4 text-xs underline-offset-4 backdrop-blur-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 md:top-6 md:right-8"
                >
                    Return to search
                </button>
                {photos.length > 0 && (
                    <details className="text-muted-foreground absolute right-4 bottom-4 max-w-[40%] text-[10px] md:right-8 md:bottom-6">
                        <summary className="cursor-pointer py-2">Photography</summary>
                        {photos.map((photo) => (
                            <div key={photo.src}>
                                <LibraryCredit source={photo.src}>
                                    <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                                        {photo.credit}
                                    </a>
                                </LibraryCredit>
                            </div>
                        ))}
                    </details>
                )}
            </div>
        </motion.div>
    );
}
