"use client";

import ViewAllBoards from "./ViewAllBoards";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { GalleryBoard } from "@/lib/my-boards";
import { toEditorialPhotoBoardCard } from "@/lib/photo-board-card";
import AccountPhotoBoardCard from "./cards/AccountPhotoBoardCard";

export default function SpatialGallery({
    boards,
    viewAllHref,
    saved = false
}: {
    boards: readonly GalleryBoard[];
    saved?: boolean;
    viewAllHref?: string;
}) {
    const [selectedId, setSelectedId] = useState(boards[0]?.collage.id ?? "");
    const selectedIndex = Math.max(
        0,
        boards.findIndex((board) => board.collage.id === selectedId)
    );
    const selected = boards[selectedIndex];
    const reducedMotion = useReducedMotion();
    const [dragProgress, setDragProgress] = useState(0);
    const [dragging, setDragging] = useState(false);
    const dragStep = useRef(312);
    const dragged = useRef(false);
    const gallery = useRef<HTMLDivElement>(null);

    function select(index: number) {
        const wrapped = ((index % boards.length) + boards.length) % boards.length;
        if (!boards[wrapped]) return;
        setSelectedId(boards[wrapped].collage.id);
    }

    if (!selected) return null;
    const selectedPhoto = selected.photo ?? toEditorialPhotoBoardCard(selected.collage);
    const caption = [selectedPhoto.durationDays ? `${selectedPhoto.durationDays} days` : "", selectedPhoto.destination]
        .filter(Boolean)
        .join(" · ");

    return (
        <section
            aria-labelledby={saved ? "recently-saved-heading" : "featured-boards-heading"}
            className={`mx-auto max-w-[1320px] ${saved ? "mt-32 md:mt-48" : "mt-20 md:mt-28"}`}
        >
            <div className="relative min-h-11 pr-24">
                {viewAllHref && (
                    <div className="absolute top-0 right-5 sm:right-12">
                        <ViewAllBoards href={viewAllHref} />
                    </div>
                )}
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
                        className="font-display text-foreground/60 text-24 md:text-36 flex justify-center gap-3 px-5 leading-none font-medium sm:px-12"
                    >
                        <span>FEATURED</span>
                        <span>BOARDS</span>
                    </h2>
                )}
            </div>
            <div className={`mx-3 mt-6 sm:mx-10 ${saved ? "grid md:grid-cols-2 md:pt-28" : ""}`}>
                <div className="min-w-0">
                    <div
                        role="region"
                        ref={gallery}
                        aria-roledescription="carousel"
                        aria-label={
                            saved
                                ? "Recently saved Boards. Use left and right arrow keys to browse."
                                : "Your Boards. Use left and right arrow keys to browse."
                        }
                        tabIndex={0}
                        onKeyDown={(event) => {
                            if (
                                event.target !== event.currentTarget &&
                                !(event.target instanceof Element && event.target.closest("[data-board-selection]"))
                            )
                                return;
                            if (
                                event.key === "ArrowLeft" ||
                                event.key === "ArrowRight" ||
                                event.key === "Home" ||
                                event.key === "End"
                            ) {
                                event.preventDefault();
                                event.currentTarget.focus({ preventScroll: true });
                                select(
                                    event.key === "Home"
                                        ? 0
                                        : event.key === "End"
                                          ? boards.length - 1
                                          : selectedIndex + (event.key === "ArrowLeft" ? -1 : 1)
                                );
                            }
                        }}
                        className="@container relative overflow-hidden pt-6 outline-offset-[-2px] focus-visible:outline-1"
                    >
                        <motion.div
                            style={{ touchAction: "pan-y" }}
                            onPointerDown={() => {
                                dragged.current = false;
                                dragStep.current =
                                    (gallery.current
                                        ?.querySelector('[data-spatial-card="active"]')
                                        ?.getBoundingClientRect().width ?? 400) * 0.78;
                            }}
                            onPan={(_, info) => {
                                dragged.current = true;
                                setDragging(true);
                                setDragProgress(info.offset.x / Math.max(1, dragStep.current));
                            }}
                            onPanEnd={(_, info) => {
                                if (Math.abs(info.offset.x) > 40 || Math.abs(info.velocity.x) > 350) {
                                    gallery.current?.focus({ preventScroll: true });
                                    const steps =
                                        Math.round(info.offset.x / Math.max(1, dragStep.current)) ||
                                        Math.sign(info.offset.x || info.velocity.x);
                                    select(selectedIndex - steps);
                                }
                                setDragProgress(0);
                                setDragging(false);
                            }}
                            onPointerCancel={() => {
                                setDragProgress(0);
                                setDragging(false);
                            }}
                            className="relative h-[calc(min(102.5cqw,500px)+1rem)] cursor-grab select-none active:cursor-grabbing sm:h-[calc(min(60cqw,500px)+1rem)]"
                        >
                            {boards.map((board, index) => {
                                const half = Math.floor(boards.length / 2);
                                const offset = ((index - selectedIndex + boards.length + half) % boards.length) - half;
                                const relative =
                                    ((((offset + dragProgress + boards.length / 2) % boards.length) + boards.length) %
                                        boards.length) -
                                    boards.length / 2;
                                const distance = Math.abs(relative);
                                const visible = distance <= 2.5;
                                const active = index === selectedIndex;
                                return (
                                    <motion.div
                                        key={board.collage.id}
                                        initial={false}
                                        data-spatial-card={active ? "active" : "inactive"}
                                        animate={{
                                            x: `${relative * 78}%`,
                                            y: Math.min(92, distance * 44),
                                            scale: Math.max(0.54, 1 - distance * 0.22),
                                            opacity: Math.max(0, 1 - distance * 0.4)
                                        }}
                                        transition={
                                            reducedMotion || dragging
                                                ? { duration: 0 }
                                                : { type: "spring", stiffness: 170, damping: 26, mass: 0.85 }
                                        }
                                        style={{
                                            zIndex: 10 - Math.min(Math.round(distance), 9),
                                            pointerEvents: visible ? "auto" : "none"
                                        }}
                                        aria-hidden={!visible}
                                        inert={!visible}
                                        className={`absolute top-0 left-1/2 ${saved ? "w-[min(400px,82cqw)]" : "w-[min(400px,82cqw)] sm:w-[min(400px,48cqw)]"} origin-center -translate-x-1/2 ${!active && !dragging ? "hidden sm:block" : ""}`}
                                    >
                                        <AccountPhotoBoardCard
                                            tilt
                                            showVisibility
                                            board={board.photo ?? toEditorialPhotoBoardCard(board.collage)}
                                            ownership={board.ownership}
                                            initialSaved={board.savedByMe}
                                            hideCoverCredit
                                            suppressHover={dragging}
                                            hoverActions={
                                                active && board.href
                                                    ? {
                                                          editHref:
                                                              board.ownership === "owner" ? board.editHref : undefined,
                                                          viewHref: board.href
                                                      }
                                                    : undefined
                                            }
                                            details={active}
                                            imageSizes="(max-width: 640px) 75vw, 400px"
                                            selection={{
                                                selected: active,
                                                viewHref: active ? board.href : undefined,
                                                onNavigate: (event) => {
                                                    if (dragged.current && event.detail !== 0) event.preventDefault();
                                                },
                                                tabIndex: active ? 0 : -1,
                                                onSelect: (event) => {
                                                    if (!dragged.current || event.detail === 0) select(index);
                                                    else event.preventDefault();
                                                }
                                            }}
                                        />
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    </div>

                    <div className="mx-auto flex justify-center px-4 py-2 sm:px-10">
                        <div className="col-start-2 row-start-1 flex items-center justify-center gap-3">
                            <button
                                type="button"
                                aria-label={saved ? "Previous saved Board" : "Previous Board"}
                                disabled={boards.length < 2}
                                onClick={() => select(selectedIndex - 1)}
                                className="hover:bg-faint grid size-11 cursor-pointer place-items-center focus-visible:outline-1 disabled:cursor-default disabled:opacity-25"
                            >
                                <ArrowLeft size={28} strokeWidth={1.5} />
                            </button>
                            <span className="text-muted-foreground text-sm tabular-nums">
                                {String(selectedIndex + 1).padStart(2, "0")} / {String(boards.length).padStart(2, "0")}
                            </span>
                            <button
                                type="button"
                                aria-label={saved ? "Next saved Board" : "Next Board"}
                                disabled={boards.length < 2}
                                onClick={() => select(selectedIndex + 1)}
                                className="hover:bg-faint grid size-11 cursor-pointer place-items-center focus-visible:outline-1 disabled:cursor-default disabled:opacity-25"
                            >
                                <ArrowRight size={28} strokeWidth={1.5} />
                            </button>
                        </div>
                    </div>
                    <p className="sr-only" aria-live="polite" aria-atomic="true">
                        {selectedPhoto.title}, by {selectedPhoto.author}. {caption}. Board {selectedIndex + 1} of{" "}
                        {boards.length}.
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
                                <p>by {selectedPhoto.author}</p>
                                {caption && <p>{caption}</p>}
                                <p>{selectedPhoto.tags?.join(", ")}</p>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </section>
    );
}
