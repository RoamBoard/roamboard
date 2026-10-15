"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { GalleryBoard } from "@/lib/my-boards";
import BoardCard from "./cards/BoardCard";

export default function SpatialGallery({
    boards,
    saved = false
}: {
    boards: readonly GalleryBoard[];
    saved?: boolean;
}) {
    const [selectedId, setSelectedId] = useState(boards[0]?.collage.id ?? "");
    const selectedIndex = Math.max(
        0,
        boards.findIndex((board) => board.collage.id === selectedId)
    );
    const selected = boards[selectedIndex];
    const reducedMotion = useReducedMotion();
    const panX = useMotionValue(0);
    const dragged = useRef(false);

    function select(index: number) {
        const wrapped = (index + boards.length) % boards.length;
        if (!boards[wrapped]) return;
        setSelectedId(boards[wrapped].collage.id);
    }

    if (!selected) return null;

    return (
        <section
            aria-labelledby={saved ? "recently-saved-heading" : "featured-boards-heading"}
            className={`mx-auto max-w-[1320px] ${saved ? "mt-32 md:mt-48" : "mt-20 md:mt-28"}`}
        >
            {saved ? (
                <h2
                    id="recently-saved-heading"
                    className="font-display text-foreground/60 text-30 md:text-36 text-center leading-[.95] font-medium"
                >
                    RECENTLY
                    <br />
                    SAVED
                </h2>
            ) : (
                <h2
                    id="featured-boards-heading"
                    className="font-display text-foreground/60 text-24 md:text-36 flex justify-between px-5 leading-none font-medium sm:px-12"
                >
                    <span>FEATURED</span>
                    <span>BOARDS</span>
                </h2>
            )}
            <div className={`border-line/50 mx-3 mt-6 sm:mx-10 ${saved ? "grid md:grid-cols-2 md:pt-28" : "border-x"}`}>
                <div className="min-w-0">
                    <div
                        role="region"
                        aria-roledescription="carousel"
                        aria-label={
                            saved
                                ? "Recently saved Boards. Use left and right arrow keys to browse."
                                : "Your Boards. Use left and right arrow keys to browse."
                        }
                        tabIndex={0}
                        onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return;
                            if (
                                event.key === "ArrowLeft" ||
                                event.key === "ArrowRight" ||
                                event.key === "Home" ||
                                event.key === "End"
                            ) {
                                event.preventDefault();
                                select(
                                    event.key === "Home"
                                        ? 0
                                        : event.key === "End"
                                          ? boards.length - 1
                                          : selectedIndex + (event.key === "ArrowLeft" ? -1 : 1)
                                );
                            }
                        }}
                        className="@container relative overflow-hidden pt-10 outline-offset-[-2px] focus-visible:outline-1 md:pt-16"
                    >
                        <motion.div
                            style={{ x: panX, touchAction: "pan-y" }}
                            onPointerDown={() => {
                                dragged.current = false;
                            }}
                            onPan={(_, info) => {
                                dragged.current = true;
                                panX.set(Math.max(-120, Math.min(120, info.offset.x * 0.45)));
                            }}
                            onPanEnd={(_, info) => {
                                if (Math.abs(info.offset.x) > 40 || Math.abs(info.velocity.x) > 350)
                                    select(selectedIndex + (info.offset.x < 0 ? 1 : -1));
                                void animate(
                                    panX,
                                    0,
                                    reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 32 }
                                );
                            }}
                            className="relative h-[390px] cursor-grab select-none active:cursor-grabbing sm:h-[520px] lg:h-[590px]"
                        >
                            {boards.map((board, index) => {
                                const half = Math.floor(boards.length / 2);
                                const offset = ((index - selectedIndex + boards.length + half) % boards.length) - half;
                                const distance = Math.abs(offset);
                                const visible = distance <= 2;
                                return (
                                    <motion.div
                                        key={board.collage.id}
                                        initial={false}
                                        animate={{
                                            x: `${offset * 65}%`,
                                            y: distance === 0 ? 0 : distance === 1 ? 55 : 110,
                                            scale: distance === 0 ? 1 : distance === 1 ? 0.75 : 0.46,
                                            opacity: distance === 0 ? 1 : distance === 1 ? 0.6 : visible ? 0.25 : 0
                                        }}
                                        transition={
                                            reducedMotion
                                                ? { duration: 0 }
                                                : { type: "spring", stiffness: 170, damping: 26, mass: 0.85 }
                                        }
                                        style={{
                                            zIndex: 10 - Math.min(distance, 9),
                                            pointerEvents: visible ? "auto" : "none"
                                        }}
                                        aria-hidden={!visible}
                                        className={`absolute top-0 left-1/2 ${saved ? "w-[clamp(244px,65cqw,440px)]" : "w-[clamp(244px,34cqw,440px)]"} origin-center -translate-x-1/2 ${distance ? "hidden sm:block" : ""}`}
                                    >
                                        <BoardCard variant="collage" board={board.collage} />
                                        <button
                                            type="button"
                                            tabIndex={-1}
                                            aria-label={`Select ${board.collage.title}`}
                                            onClick={() => {
                                                if (!dragged.current) select(index);
                                            }}
                                            className="absolute inset-0 cursor-pointer"
                                        />
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    </div>

                    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 pb-8 sm:px-10">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                aria-label={saved ? "Previous saved Board" : "Previous Board"}
                                disabled={boards.length < 2}
                                onClick={() => select(selectedIndex - 1)}
                                className="hover:bg-faint grid size-11 cursor-pointer place-items-center focus-visible:outline-1 disabled:cursor-default disabled:opacity-25"
                            >
                                <ArrowLeft size={19} strokeWidth={1.5} />
                            </button>
                            <span className="text-10 text-muted-foreground tabular-nums">
                                {String(selectedIndex + 1).padStart(2, "0")} / {String(boards.length).padStart(2, "0")}
                            </span>
                            <button
                                type="button"
                                aria-label={saved ? "Next saved Board" : "Next Board"}
                                disabled={boards.length < 2}
                                onClick={() => select(selectedIndex + 1)}
                                className="hover:bg-faint grid size-11 cursor-pointer place-items-center focus-visible:outline-1 disabled:cursor-default disabled:opacity-25"
                            >
                                <ArrowRight size={19} strokeWidth={1.5} />
                            </button>
                        </div>
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.p
                                key={selected.collage.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: reducedMotion ? 0 : 0.12 }}
                                className="text-12 text-muted-foreground"
                            >
                                {selected.collage.durationDays} days · {selected.collage.destination}
                            </motion.p>
                        </AnimatePresence>
                        {selected.href && (
                            <Link className="text-12 py-3 underline underline-offset-4" href={selected.href}>
                                open Board ↗
                            </Link>
                        )}
                    </div>
                    <p className="sr-only" aria-live="polite" aria-atomic="true">
                        {selected.collage.title}, by {selected.collage.author}. {selected.collage.durationDays} days in{" "}
                        {selected.collage.destination}. Board {selectedIndex + 1} of {boards.length}.
                    </p>
                </div>
                {saved && (
                    <div className="border-line/60 flex min-w-0 items-center justify-center border-t px-6 py-14 md:border-t-0 md:border-l md:px-12">
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={selected.collage.id}
                                initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: reducedMotion ? 0 : 0.18 }}
                                className="font-display text-foreground/65 text-24 md:text-30 space-y-10 text-center leading-tight lg:space-y-20"
                            >
                                <p>by {selected.collage.author}</p>
                                <p>
                                    {selected.collage.durationDays} days | {selected.collage.destination}
                                </p>
                                <p>{selected.collage.themes.join(", ")}</p>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </section>
    );
}
