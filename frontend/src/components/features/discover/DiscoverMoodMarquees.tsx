"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Marquee } from "@/components/ui/marquee";
import { discoverMoodRows, discoverCollectionHref, type DiscoverCollection } from "@/data/discover-collections";

function MoodLink({ collection, moving = false }: { collection: DiscoverCollection; moving?: boolean }) {
    const link = useRef<HTMLAnchorElement>(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        if (!moving || !link.current) return;
        // Loop copies outside the clipped row must not enter the tab order.
        const observer = new IntersectionObserver(
            ([entry]) => {
                // Large titles can exceed the mobile row width; keep a
                // substantially visible title reachable by keyboard.
                const rowWidth = entry.rootBounds?.width ?? entry.boundingClientRect.width;
                const threshold = Math.min(0.95, (rowWidth / Math.max(entry.boundingClientRect.width, 1)) * 0.65);
                setVisible(entry.intersectionRatio >= threshold);
            },
            {
                root: link.current.closest("[data-marquee]"),
                threshold: Array.from({ length: 21 }, (_, index) => index / 20)
            }
        );
        observer.observe(link.current);
        return () => observer.disconnect();
    }, [moving]);
    return (
        <Link
            ref={link}
            href={discoverCollectionHref(collection)}
            prefetch={false}
            tabIndex={moving && !visible ? -1 : 0}
            aria-hidden={moving && !visible ? true : undefined}
            className="hover:text-foreground focus-visible:text-foreground inline-flex min-h-11 shrink-0 items-center py-3 transition-colors duration-300 focus-visible:outline-2 focus-visible:-outline-offset-2 motion-reduce:transition-none"
        >
            {collection.title}
        </Link>
    );
}

export default function DiscoverMoodMarquees() {
    const [showAll, setShowAll] = useState(false);
    return (
        <section
            id="discover-moods"
            aria-label="More curated collections"
            className="relative -mx-5 mt-16 scroll-mt-0 md:-mx-10 md:mt-20"
        >
            <button
                type="button"
                aria-pressed={showAll}
                onClick={() => setShowAll(!showAll)}
                className="focus:bg-background sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-20 focus:px-4 focus:py-3 focus:outline-2 motion-reduce:hidden"
            >
                {showAll ? "Show animated collections" : "Browse all collections without motion"}
            </button>
            {!showAll && (
                <div className="border-line grid grid-rows-5 border-t motion-reduce:hidden">
                    {discoverMoodRows.map((collections, row) => (
                        <Marquee
                            key={row}
                            reverse={row % 2 === 1}
                            pauseOnHover
                            repeat={4}
                            aria-label={`Travel moods, row ${row + 1}`}
                            className="border-line text-muted-foreground font-display min-h-0 items-center border-b py-4 text-[clamp(1.5rem,3vw,3rem)] leading-none font-medium tracking-tight [--duration:90s] [--gap:2rem] md:py-6 md:[--gap:4rem]"
                        >
                            {collections.map((collection) => (
                                <div key={collection.id} className="flex shrink-0 items-center gap-(--gap)">
                                    <MoodLink collection={collection} moving />
                                    <span className="text-faint" aria-hidden="true">
                                        ·
                                    </span>
                                </div>
                            ))}
                        </Marquee>
                    ))}
                </div>
            )}
            <div className={`${showAll ? "grid" : "hidden motion-reduce:grid"} border-line grid-rows-5 border-t`}>
                {discoverMoodRows.map((collections, row) => (
                    <div
                        key={row}
                        className="border-line text-muted-foreground font-display flex flex-wrap items-center gap-x-8 border-b py-4 text-[clamp(1.5rem,3vw,3rem)] leading-none font-medium tracking-tight md:py-6"
                    >
                        {collections.map((collection) => (
                            <MoodLink key={collection.id} collection={collection} />
                        ))}
                    </div>
                ))}
            </div>
        </section>
    );
}
