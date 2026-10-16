"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import type { DestinationPageData } from "@/data/destination-atlas";
import BoardCard from "@/components/features/boards/cards/BoardCard";

export function DestinationStories({ destination }: { destination: DestinationPageData }) {
    const [selected, setSelected] = useState(0);
    const dragged = useRef(false);
    const reduced = useReducedMotion();
    const boards = destination.relatedBoards;
    const board = boards[selected];
    if (!board) return null;

    function select(index: number) {
        setSelected((index + boards.length) % boards.length);
    }

    return (
        <section
            id="destination-boards"
            tabIndex={-1}
            aria-labelledby="destination-boards-heading"
            className="border-line relative flex h-full w-[var(--destination-width)] shrink-0 flex-col overflow-y-auto border-x px-6 py-7 outline-none md:w-[max(1100px,var(--destination-width))] md:flex-row md:gap-8 md:px-14 md:py-12"
        >
            <div className="md:border-line relative z-10 flex shrink-0 flex-col justify-center md:w-[27%] md:border-r md:pr-8">
                <p className="text-muted-foreground text-[10px] tracking-[0.2em] uppercase">Trending boards</p>
                <h2
                    id="destination-boards-heading"
                    className="font-display mt-5 text-[clamp(2.7rem,min(5vw,9dvh),5.5rem)] leading-[0.95] tracking-[-0.055em]"
                >
                    Trending boards for {destination.name}
                </h2>
                <p className="text-muted-foreground mt-6 max-w-60 text-xs leading-6">
                    A few different ways to see {destination.name}. Find a story that feels like you.
                </p>
                <p className="text-muted-foreground mt-4 max-w-60 text-[10px] leading-5">
                    Sample Boards · Illustrative content. Traveler Boards aren’t connected yet.
                </p>
            </div>
            <div
                role="region"
                aria-roledescription="carousel"
                aria-label={`${destination.name} sample Boards`}
                tabIndex={0}
                onKeyDown={(event) => {
                    if (
                        event.key === "ArrowLeft" ||
                        event.key === "ArrowRight" ||
                        event.key === "Home" ||
                        event.key === "End"
                    ) {
                        event.preventDefault();
                        event.stopPropagation();
                        select(
                            event.key === "Home"
                                ? 0
                                : event.key === "End"
                                  ? boards.length - 1
                                  : selected + (event.key === "ArrowLeft" ? -1 : 1)
                        );
                    }
                }}
                className="relative mt-5 flex min-h-[380px] min-w-0 flex-1 flex-col focus-visible:outline-2 focus-visible:outline-offset-2 md:mt-0"
            >
                <motion.div
                    style={{ containerType: "size", touchAction: "pan-y" }}
                    onPointerDown={() => {
                        dragged.current = false;
                    }}
                    onPan={(_, info) => {
                        if (Math.abs(info.offset.x) > 8) dragged.current = true;
                    }}
                    onPanEnd={(_, info) => {
                        if (Math.abs(info.offset.x) > 45 || Math.abs(info.velocity.x) > 350)
                            select(selected + (info.offset.x < 0 ? 1 : -1));
                    }}
                    className="relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
                >
                    <span
                        aria-hidden="true"
                        className="font-display text-foreground/[0.018] pointer-events-none absolute right-0 bottom-6 text-[clamp(8rem,24vw,24rem)] leading-none tracking-tighter"
                    >
                        {destination.countryCode}
                    </span>
                    {boards.map((item, index) => {
                        const half = Math.floor(boards.length / 2);
                        const offset = ((index - selected + boards.length + half) % boards.length) - half;
                        const focused = offset === 0;
                        return (
                            <motion.div
                                key={item.id}
                                role="group"
                                aria-roledescription="slide"
                                aria-label={`${index + 1} of ${boards.length}: ${item.title}`}
                                initial={false}
                                animate={{
                                    x: `${offset * 66}%`,
                                    y: focused ? 0 : 34,
                                    scale: focused ? 1 : 0.72,
                                    rotate: 0,
                                    opacity: focused ? 1 : 0.48
                                }}
                                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 145, damping: 25 }}
                                style={{ zIndex: focused ? 10 : 1 }}
                                className="absolute top-[3%] left-1/2 w-[min(440px,72cqh,80cqw)] origin-center -translate-x-1/2 select-none"
                            >
                                <BoardCard variant="collage" board={item} />
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    aria-label={`Select ${item.title}`}
                                    aria-pressed={focused}
                                    onClick={(event) => {
                                        if (!dragged.current || event.detail === 0) select(index);
                                    }}
                                    className="absolute inset-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4"
                                />
                            </motion.div>
                        );
                    })}
                </motion.div>
                <div className="border-line relative z-20 flex shrink-0 items-center justify-between gap-4 border-t py-3">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            aria-label="Previous slide"
                            disabled={boards.length < 2}
                            onClick={() => select(selected - 1)}
                            className="hover:bg-faint grid size-11 place-items-center focus-visible:outline-2 disabled:opacity-30"
                        >
                            <ArrowLeft size={20} strokeWidth={1} />
                        </button>
                        <span className="text-muted-foreground text-[10px] tabular-nums">
                            {String(selected + 1).padStart(2, "0")} / {String(boards.length).padStart(2, "0")}
                        </span>
                        <button
                            type="button"
                            aria-label="Next slide"
                            disabled={boards.length < 2}
                            onClick={() => select(selected + 1)}
                            className="hover:bg-faint grid size-11 place-items-center focus-visible:outline-2 disabled:opacity-30"
                        >
                            <ArrowRight size={20} strokeWidth={1} />
                        </button>
                    </div>
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.p
                            key={board.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: reduced ? 0 : 0.15 }}
                            className="text-muted-foreground text-right text-xs"
                        >
                            {board.durationDays} days / {destination.name}
                        </motion.p>
                    </AnimatePresence>
                    {board.href && (
                        <Link
                            href={board.href}
                            className="inline-flex min-h-11 items-center gap-2 text-xs underline underline-offset-4"
                        >
                            Open Board <ArrowUpRight size={15} />
                        </Link>
                    )}
                </div>
                <p className="sr-only" aria-live="polite" aria-atomic="true">
                    {board.title}, {board.durationDays} days in {destination.name}. Board {selected + 1} of{" "}
                    {boards.length}.
                </p>
            </div>
        </section>
    );
}
