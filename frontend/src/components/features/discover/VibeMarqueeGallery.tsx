"use client";

import Image from "@/components/images/LibraryImage";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Marquee } from "@/components/ui/marquee";
import TagIcon from "@/components/ui/TagIcon";
import { boardTagHref, type BoardTag } from "@/data/board-tags";

function subscribeToColumns(update: () => void) {
    const queries = [window.matchMedia("(min-width: 768px)"), window.matchMedia("(min-width: 1024px)")];
    queries.forEach((query) => query.addEventListener("change", update));
    return () => queries.forEach((query) => query.removeEventListener("change", update));
}

function getColumns() {
    return window.matchMedia("(min-width: 1024px)").matches
        ? 5
        : window.matchMedia("(min-width: 768px)").matches
          ? 3
          : 2;
}

function VibeCard({ tag, moving = false }: { tag: BoardTag; moving?: boolean }) {
    const link = useRef<HTMLAnchorElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!moving || !link.current) return;
        // Only visible copies enter the tab order; offscreen loops never steal focus.
        const observer = new IntersectionObserver(
            ([entry]) => {
                setVisible(entry.intersectionRatio >= 0.65);
            },
            { threshold: [0, 0.65, 1] }
        );
        observer.observe(link.current);
        return () => observer.disconnect();
    }, [moving]);

    return (
        <Link
            ref={link}
            href={boardTagHref(tag.id)}
            prefetch={false}
            tabIndex={moving && !visible ? -1 : 0}
            aria-hidden={moving && !visible ? true : undefined}
            aria-label={`Explore ${tag.name} Boards`}
            className="group relative block aspect-[3/5] w-full shrink-0 overflow-hidden focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
        >
            <Image
                src={tag.gridImage.url}
                alt={tag.gridImage.alt}
                fill
                unoptimized
                sizes="(max-width: 767px) 45vw, (max-width: 1023px) 30vw, 18vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 group-focus-visible:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
            />
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/10 to-black/40"
            />
            <h3 className="relative z-10 p-3 text-[clamp(1rem,2.3vw,2.75rem)] leading-none font-medium tracking-tight md:p-5">
                {tag.name}
            </h3>
            <TagIcon tag={tag} size={96} className="absolute -right-3 bottom-3 z-10 size-20 opacity-90 md:size-28" />
        </Link>
    );
}

export default function VibeMarqueeGallery({ tags }: { tags: readonly BoardTag[] }) {
    const columns = useSyncExternalStore(subscribeToColumns, getColumns, () => 2);
    const [paused, setPaused] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const controlClass =
        "flex items-center gap-2 py-2 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";

    return (
        <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <p className="text-12 text-white/70 motion-reduce:hidden">
                    Hover to slow and pause. Focus a card to pause its column.
                </p>
                <div className="flex gap-6">
                    {!showAll && (
                        <button
                            type="button"
                            aria-pressed={paused}
                            onClick={() => setPaused(!paused)}
                            className={`${controlClass} motion-reduce:hidden`}
                        >
                            {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
                            {paused ? "Resume gallery" : "Pause gallery"}
                        </button>
                    )}
                    <button
                        type="button"
                        aria-pressed={showAll}
                        onClick={() => setShowAll(!showAll)}
                        className={`${controlClass} motion-reduce:hidden`}
                    >
                        {showAll ? "Animated gallery" : "View all vibes"}
                    </button>
                </div>
            </div>
            {!showAll && (
                <div className="relative motion-reduce:hidden">
                    <div
                        className="grid h-[min(70svh,42rem)] min-h-80 grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5"
                        aria-label="Animated vibe gallery"
                    >
                        {Array.from({ length: columns }, (_, column) => {
                            const columnTags = tags.filter((_, index) => index % columns === column);
                            return (
                                <Marquee
                                    key={`${columns}-${column}`}
                                    vertical
                                    reverse={column % 2 === 1}
                                    pauseOnHover
                                    paused={paused}
                                    className="h-full min-w-0"
                                    style={
                                        {
                                            "--gap": "0.5rem",
                                            "--duration": `${Math.max(columnTags.length, 1) * 22}s`
                                        } as CSSProperties
                                    }
                                >
                                    {columnTags.map((tag) => (
                                        <VibeCard key={tag.id} tag={tag} moving />
                                    ))}
                                </Marquee>
                            );
                        })}
                    </div>
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black to-transparent"
                    />
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black to-transparent"
                    />
                </div>
            )}
            <div
                className={`${showAll ? "grid" : "hidden motion-reduce:grid"} grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5`}
                aria-label="All vibes"
            >
                {tags.map((tag) => (
                    <VibeCard key={tag.id} tag={tag} />
                ))}
            </div>
        </>
    );
}
