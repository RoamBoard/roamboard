"use client";

import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { MoveUpRight } from "lucide-react";
import type { AtlasCategory, AtlasPlace, DestinationPageData } from "@/data/destination-atlas";
import AtlasPhoto from "./AtlasPhoto";
import { PlaceDetail } from "./PlaceDetail";

// A different photographic rhythm for each city; the place components and interactions stay shared.
const compositions = {
    quiet: [
        "lg:col-start-1 lg:row-span-2 lg:row-start-1",
        "lg:col-start-2 lg:row-span-2 lg:row-start-1",
        "lg:col-start-3 lg:row-start-1",
        "lg:col-start-3 lg:row-start-2"
    ],
    romantic: [
        "lg:col-start-1 lg:row-span-2 lg:row-start-1",
        "lg:col-start-2 lg:row-start-1",
        "lg:col-start-2 lg:row-start-2",
        "lg:col-start-3 lg:row-span-2 lg:row-start-1"
    ],
    graphic: [
        "lg:col-span-2 lg:row-start-1",
        "lg:col-start-1 lg:row-start-2",
        "lg:col-start-3 lg:row-span-2 lg:row-start-1",
        "lg:col-start-2 lg:row-start-2"
    ]
};

export function DestinationAtlas({ destination }: { destination: DestinationPageData }) {
    const [category, setCategory] = useState<AtlasCategory | "All">("All");
    const [selected, setSelected] = useState<AtlasPlace | null>(null);
    const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
    const [hovered, setHovered] = useState<string | null>(null);
    const reduced = useReducedMotion();
    const categories = ["All", ...new Set(destination.places.map((place) => place.category))] as const;
    const places = destination.places.filter((place) => category === "All" || place.category === category);

    return (
        <section
            id="atlas"
            tabIndex={-1}
            aria-labelledby="atlas-heading"
            className={`bg-background text-foreground border-line relative isolate h-full w-[var(--destination-width)] shrink-0 overflow-y-auto border-l [color-scheme:dark] outline-none [--background:var(--atlas-background)] [--foreground:var(--atlas-foreground)] [--line:var(--atlas-line)] [--muted-foreground:var(--atlas-muted)] lg:overflow-y-hidden ${places.length > 2 ? "lg:w-[max(1900px,165vw)]" : "lg:w-[max(1250px,112vw)]"}`}
        >
            <div className="relative grid min-h-full px-6 py-8 lg:h-full lg:grid-cols-[clamp(340px,32vw,520px)_minmax(0,1fr)] lg:gap-10 lg:px-14 lg:py-10">
                <div className="border-line relative z-10 flex flex-col lg:border-r lg:pr-10">
                    <div className="border-line flex items-center justify-between border-t pt-4 text-[10px] tracking-[0.18em] uppercase">
                        <span>Trending destinations</span>
                        <span>{destination.nativeName}</span>
                    </div>
                    <motion.div
                        initial={{ opacity: 0.4 }}
                        whileInView={{ opacity: 1 }}
                        transition={{ duration: reduced ? 0 : 0.7 }}
                        viewport={{ once: true, amount: 0.2 }}
                        className="mt-10 lg:my-auto lg:py-6"
                    >
                        <h2
                            id="atlas-heading"
                            className="font-display text-[clamp(2.7rem,min(5vw,9dvh),5.5rem)] leading-[0.95] font-medium tracking-[-0.055em]"
                        >
                            Trending destinations in {destination.name} right now
                        </h2>
                        <p className="text-muted-foreground mt-8 max-w-[30ch] text-sm leading-6">
                            {destination.atlasIntroduction}
                        </p>
                    </motion.div>
                    <div
                        aria-label="Filter trending destinations"
                        className="border-line mt-8 flex flex-wrap gap-x-5 border-y py-1 lg:mt-0"
                    >
                        {categories.map((item) => (
                            <button
                                key={item}
                                type="button"
                                aria-pressed={category === item}
                                onClick={() => {
                                    setHovered(null);
                                    setCategory(item);
                                }}
                                className={`min-h-11 border-b py-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none ${category === item ? "text-foreground border-foreground" : "text-muted-foreground hover:text-foreground border-transparent"}`}
                            >
                                {item === "All" ? "All discoveries" : item}
                            </button>
                        ))}
                    </div>
                    <p aria-live="polite" className="text-muted-foreground mt-4 text-[10px] tracking-wide">
                        {places.length} {places.length === 1 ? "place" : "places"} / A starting point. Never a fixed
                        route.
                    </p>
                </div>
                <LayoutGroup id={`atlas-${destination.slug}`}>
                    <motion.div
                        layoutScroll
                        onPointerLeave={() => setHovered(null)}
                        className={`relative mt-8 grid min-h-0 grid-cols-2 gap-4 lg:mt-0 lg:h-full lg:grid-rows-2 lg:gap-6 ${places.length < 3 ? "lg:grid-cols-2" : "lg:grid-cols-[1.3fr_0.85fr_1fr]"}`}
                    >
                        <AnimatePresence mode="popLayout" initial={false}>
                            {places.map((place, index) => (
                                <motion.article
                                    key={place.id}
                                    layout={!reduced}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: reduced ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
                                    className={`relative min-h-0 ${index === 0 || index === 3 ? "col-span-2 lg:col-span-1" : ""} ${places.length < 3 ? `lg:row-span-2 lg:row-start-1 ${places.length === 1 ? "lg:col-span-2" : ""}` : compositions[destination.composition][index % 4]}`}
                                >
                                    <motion.button
                                        type="button"
                                        aria-label={`Explore ${place.name}`}
                                        aria-haspopup="dialog"
                                        onPointerEnter={(event) => {
                                            if (event.pointerType === "mouse") setHovered(place.id);
                                        }}
                                        onFocus={() => setHovered(place.id)}
                                        onBlur={() => setHovered(null)}
                                        onClick={(event) => {
                                            setTrigger(event.currentTarget);
                                            setSelected(place);
                                        }}
                                        animate={{ opacity: hovered && hovered !== place.id ? 0.64 : 1 }}
                                        transition={{ duration: reduced ? 0 : 0.3 }}
                                        className={`group relative block w-full cursor-pointer overflow-hidden text-left focus-visible:outline-2 focus-visible:outline-offset-4 lg:h-full ${index === 0 ? "aspect-[4/5] lg:aspect-auto" : index === 3 ? "aspect-[5/4] lg:aspect-auto" : "aspect-[3/5] lg:aspect-auto"}`}
                                    >
                                        <motion.div
                                            layoutId={reduced ? undefined : `${place.id}-photo`}
                                            className="bg-faint absolute inset-0"
                                        >
                                            <motion.div
                                                whileHover={reduced ? undefined : { scale: 1.045 }}
                                                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                                                className="absolute inset-0"
                                            >
                                                <AtlasPhoto
                                                    image={place.image}
                                                    sizes="(max-width: 1023px) 80vw, 65vw"
                                                />
                                            </motion.div>
                                        </motion.div>
                                        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/10 to-black/20" />
                                        <span className="absolute top-4 right-4 left-4 flex items-center justify-between gap-3 border-t border-white/40 pt-3 text-[9px] tracking-[0.14em] text-white/90 uppercase lg:top-6 lg:right-6 lg:left-6">
                                            {place.category}
                                            <MoveUpRight size={17} strokeWidth={1} aria-hidden="true" />
                                        </span>
                                        <div className="absolute right-4 bottom-5 left-4 lg:right-6 lg:bottom-7 lg:left-6">
                                            <p className="mb-3 hidden text-[10px] text-white/75 lg:block">
                                                {place.neighborhood}
                                            </p>
                                            <h3
                                                className={`font-display leading-[0.92] tracking-[-0.045em] break-words text-white ${index === 0 ? "text-[clamp(2.6rem,4.5vw,5rem)]" : "text-[clamp(1.25rem,2.6vw,3rem)]"}`}
                                            >
                                                {place.name}
                                            </h3>
                                            <p
                                                className={`mt-3 max-w-[32ch] text-xs leading-5 text-white/85 ${index === 0 || index === 3 ? "" : "hidden sm:block"}`}
                                            >
                                                {place.caption}
                                            </p>
                                        </div>
                                    </motion.button>
                                </motion.article>
                            ))}
                        </AnimatePresence>
                        <span
                            aria-hidden="true"
                            className="text-muted-foreground absolute -right-8 bottom-0 hidden text-[10px] tracking-[0.3em] uppercase [writing-mode:vertical-rl] lg:block"
                        >
                            Look closer. Stay a little longer.
                        </span>
                    </motion.div>
                    <AnimatePresence>
                        {selected && (
                            <PlaceDetail
                                destination={destination}
                                place={selected}
                                onClose={() => setSelected(null)}
                                onNavigate={setSelected}
                                returnFocusTo={trigger}
                            />
                        )}
                    </AnimatePresence>
                </LayoutGroup>
            </div>
        </section>
    );
}
