"use client";

import { LibraryCredit } from "@/components/images/LibraryImage";
import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, ArrowUpRight, X } from "lucide-react";
import type { AtlasPlace, DestinationPageData } from "@/data/destination-atlas";
import AtlasPhoto from "./AtlasPhoto";

export function PlaceDetail({
    destination,
    place,
    onClose,
    onNavigate,
    returnFocusTo
}: {
    destination: DestinationPageData;
    place: AtlasPlace;
    onClose: () => void;
    onNavigate?: (place: AtlasPlace) => void;
    returnFocusTo?: HTMLButtonElement | null;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const previousPlace = useRef(place.id);
    const id = useId();
    const reduced = useReducedMotion();
    const index = destination.places.findIndex((item) => item.id === place.id);
    useEffect(() => {
        const dialog = ref.current;
        const trigger =
            returnFocusTo ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        const overflow = document.body.style.overflow;
        dialog?.showModal();
        document.body.style.overflow = "hidden";
        return () => {
            dialog?.close();
            document.body.style.overflow = overflow;
            trigger?.focus({ preventScroll: true });
        };
    }, [returnFocusTo]);

    useEffect(() => {
        if (previousPlace.current === place.id) return;
        previousPlace.current = place.id;
        ref.current?.scrollTo({ top: 0, behavior: "instant" });
        headingRef.current?.focus({ preventScroll: true });
    }, [place.id]);

    function navigate(direction: number) {
        const next = destination.places[(index + direction + destination.places.length) % destination.places.length];
        onNavigate?.(next);
    }
    return (
        <dialog
            ref={ref}
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-caption`}
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
            className="bg-background text-foreground fixed inset-0 m-auto max-h-[94dvh] w-[calc(100%-1.5rem)] max-w-[1440px] overflow-y-auto border-0 p-0 backdrop:bg-black/65 md:w-[92vw]"
        >
            <motion.div
                layoutRoot
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.2 }}
            >
                <header className="border-line bg-background sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b px-5 md:px-9">
                    <p className="text-xs tracking-widest uppercase">
                        {destination.name} / Trending destinations{" "}
                        <span className="text-muted-foreground ml-4">
                            {String(index + 1).padStart(2, "0")} — {String(destination.places.length).padStart(2, "0")}
                        </span>
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close place details"
                        className="hover:bg-faint grid size-11 shrink-0 place-items-center focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                        <X size={23} strokeWidth={1} />
                    </button>
                </header>
                <div className="grid md:grid-cols-[1.05fr_1fr]">
                    <motion.div
                        key={place.id}
                        layoutId={reduced ? undefined : `${place.id}-photo`}
                        transition={{ duration: reduced ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="bg-faint relative aspect-[4/3] overflow-hidden md:sticky md:top-16 md:aspect-auto md:h-[min(76dvh,850px)]"
                    >
                        <div className="absolute inset-0">
                            <AtlasPhoto
                                key={place.image.src}
                                image={place.image}
                                eager
                                sizes="(max-width: 767px) 95vw, 48vw"
                            />
                        </div>
                    </motion.div>
                    <motion.div
                        key={`${place.id}-story`}
                        initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : 0.1 }}
                        className="flex flex-col px-6 py-9 md:px-12 md:py-14"
                    >
                        <p className="text-muted-foreground text-xs tracking-widest uppercase">
                            {place.category} / {place.neighborhood}
                        </p>
                        <h2
                            ref={headingRef}
                            tabIndex={-1}
                            id={`${id}-title`}
                            className="font-display mt-7 text-[clamp(2.5rem,5vw,5rem)] leading-[0.9] font-medium tracking-tight outline-none"
                        >
                            {place.name}
                        </h2>
                        <p id={`${id}-caption`} className="font-display mt-6 text-2xl leading-tight">
                            {place.caption}
                        </p>
                        <p className="text-muted-foreground mt-7 max-w-lg text-sm leading-7">{place.story}</p>
                        <div className="border-line mt-8 grid grid-cols-[3rem_1fr] gap-3 border-y py-5">
                            <span className="text-muted-foreground text-xs">NOTE</span>
                            <p className="text-sm leading-6">{place.note}</p>
                        </div>
                        <div className="mt-5 flex flex-wrap gap-x-7 gap-y-2 text-xs">
                            <a
                                href={`https://www.openstreetmap.org/?mlat=${place.coordinates.latitude}&mlon=${place.coordinates.longitude}#map=17/${place.coordinates.latitude}/${place.coordinates.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-h-11 items-center gap-2 underline underline-offset-4"
                            >
                                View on map <ArrowUpRight size={14} />
                            </a>
                            <a
                                href={place.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-h-11 items-center gap-2 underline underline-offset-4"
                            >
                                Visitor information <ArrowUpRight size={14} />
                            </a>
                        </div>
                        <div className="mt-9">
                            <p className="text-muted-foreground text-xs">Let this be the beginning of something.</p>
                            <Link
                                href="/boards/new"
                                className="border-foreground mt-3 flex min-h-14 items-center justify-between gap-4 border-b py-3 font-medium"
                            >
                                Create your own Board <ArrowUpRight size={22} strokeWidth={1} />
                            </Link>
                        </div>
                        <LibraryCredit
                            source={place.image.src}
                            className="text-muted-foreground mt-8 w-fit py-2 text-[11px] underline underline-offset-4"
                        >
                            <a
                                href={place.image.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-muted-foreground mt-8 w-fit py-2 text-[11px] underline underline-offset-4"
                            >
                                Photography: {place.image.credit}
                            </a>
                        </LibraryCredit>
                    </motion.div>
                </div>
                {onNavigate && (
                    <footer className="border-line flex items-center justify-between border-t px-5 py-3 md:px-9">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="flex min-h-11 items-center gap-3 text-sm"
                        >
                            <ArrowLeft size={18} strokeWidth={1} /> Previous place
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(1)}
                            className="flex min-h-11 items-center gap-3 text-sm"
                        >
                            Next place <ArrowRight size={18} strokeWidth={1} />
                        </button>
                    </footer>
                )}
            </motion.div>
        </dialog>
    );
}
