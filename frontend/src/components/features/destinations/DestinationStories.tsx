"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { destinationPhotoUrl, type DestinationBoardSummary } from "@/lib/destination-guides";
import DestinationStoryCard from "./DestinationStoryCard";

type Props = {
    name: string;
    countryCode: string;
    boards: DestinationBoardSummary[];
    hasMore?: boolean;
    onLoadMore?: () => void;
    loadingMore?: boolean;
    error?: string;
    onRetry?: () => void;
};

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Requests, pagination and retries remain owned by the destination guide hook.
export function DestinationStories({
    name,
    countryCode,
    boards,
    hasMore,
    onLoadMore,
    loadingMore,
    error,
    onRetry
}: Props) {
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const dragged = useRef(false);
    const dragStep = useRef(320);
    const [dragProgress, setDragProgress] = useState(0);
    const [dragging, setDragging] = useState(false);
    const gallery = useRef<HTMLDivElement>(null);
    const reduced = useReducedMotion();
    const selected = Math.max(
        0,
        boards.findIndex((item) => item.boardId === selectedId)
    );
    const board = boards[selected];

    function select(index: number) {
        if (boards.length) setSelectedId(boards[(index + boards.length) % boards.length].boardId);
    }

    return (
        <section
            id="destination-boards"
            data-destination-chapter
            tabIndex={-1}
            aria-labelledby="destination-boards-heading"
            className="relative flex h-full w-[var(--destination-width)] shrink-0 snap-start snap-always flex-col overflow-y-auto bg-[var(--atlas-background)] px-6 py-7 text-[var(--atlas-foreground)] outline-none [--line:var(--atlas-line)] [--muted-foreground:var(--atlas-muted)] md:flex-row md:gap-8 md:px-14 md:py-12"
        >
            <div className="md:border-line relative z-10 flex shrink-0 flex-col justify-center md:w-[27%] md:border-r md:pr-8">
                <p className="text-muted-foreground text-[10px] tracking-[0.2em] uppercase">Public boards</p>
                <h2
                    id="destination-boards-heading"
                    className="font-display mt-5 text-[clamp(2.7rem,min(4vw,8dvh),4.75rem)] leading-[0.95] tracking-[-0.055em] [overflow-wrap:anywhere]"
                >
                    Boards in and around {name}
                </h2>
                <p className="text-muted-foreground mt-6 max-w-60 text-xs leading-6">
                    Trips shared by travellers with activities near {name}. Newest updated first.
                </p>
                <div aria-live="polite" className="mt-4">
                    {error ? (
                        <div role="alert" className="text-sm">
                            <p>{error}</p>
                            <button
                                type="button"
                                onClick={onRetry}
                                disabled={loadingMore}
                                className="mt-2 min-h-11 underline underline-offset-4 disabled:opacity-50"
                            >
                                Retry public boards
                            </button>
                        </div>
                    ) : hasMore ? (
                        <button
                            type="button"
                            onClick={onLoadMore}
                            disabled={loadingMore}
                            className="min-h-11 border border-[var(--atlas-line)] px-5 text-xs disabled:opacity-50"
                        >
                            {loadingMore ? "Loading boards..." : "Load more boards"}
                        </button>
                    ) : null}
                </div>
            </div>
            {!board ? (
                <p role="status" className="text-muted-foreground py-16 text-sm">
                    {loadingMore
                        ? "Loading boards..."
                        : error
                          ? "Public boards are unavailable right now."
                          : `No public Boards in and around ${name} yet.`}
                </p>
            ) : (
                <div
                    role="region"
                    ref={gallery}
                    aria-roledescription="carousel"
                    aria-label={`${name} public Boards`}
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
                            event.stopPropagation();
                            event.currentTarget.focus({ preventScroll: true });
                            select(
                                event.key === "Home"
                                    ? 0
                                    : event.key === "End"
                                      ? boards.length - 1
                                      : selected + (event.key === "ArrowLeft" ? -1 : 1)
                            );
                        }
                    }}
                    className="relative mt-7 flex min-h-[440px] min-w-0 flex-1 flex-col focus-visible:outline-2 focus-visible:outline-offset-2 md:mt-0 md:min-h-[380px]"
                >
                    <motion.div
                        style={{ containerType: "size", touchAction: "pan-y" }}
                        onPointerDown={() => {
                            dragged.current = false;
                            dragStep.current =
                                (gallery.current
                                    ?.querySelector('[data-destination-card="active"]')
                                    ?.getBoundingClientRect().width ?? 420) * 0.76;
                        }}
                        onPan={(_, info) => {
                            if (Math.abs(info.offset.x) > 8) {
                                dragged.current = true;
                                setDragging(true);
                                setDragProgress(info.offset.x / Math.max(1, dragStep.current));
                            }
                        }}
                        onPanEnd={(_, info) => {
                            if (Math.abs(info.offset.x) > 45 || Math.abs(info.velocity.x) > 350) {
                                gallery.current?.focus({ preventScroll: true });
                                select(selected + (info.offset.x < 0 ? 1 : -1));
                            }
                            setDragging(false);
                            setDragProgress(0);
                        }}
                        onPointerCancel={() => {
                            setDragging(false);
                            setDragProgress(0);
                        }}
                        className="relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
                    >
                        <span
                            aria-hidden="true"
                            className="font-display text-foreground/[0.018] pointer-events-none absolute right-0 bottom-6 text-[clamp(8rem,24vw,24rem)] leading-none tracking-tighter"
                        >
                            {countryCode}
                        </span>
                        {boards.map((item, index) => {
                            const half = Math.floor(boards.length / 2);
                            const offset = ((index - selected + boards.length + half) % boards.length) - half;
                            const focused = offset === 0;
                            const relative =
                                ((((offset + dragProgress + boards.length / 2) % boards.length) + boards.length) %
                                    boards.length) -
                                boards.length / 2;
                            const distance = Math.abs(relative);
                            return (
                                <motion.div
                                    key={item.boardId}
                                    data-destination-card={focused ? "active" : "inactive"}
                                    role="group"
                                    aria-roledescription="slide"
                                    aria-label={`${index + 1} of ${boards.length}: ${item.title}`}
                                    initial={false}
                                    animate={{
                                        x: `${relative * 76}%`,
                                        y: Math.min(56, distance * 28),
                                        scale: Math.max(0.52, 1 - distance * 0.24),
                                        rotate: 0,
                                        opacity: Math.max(0, 1 - distance * 0.52)
                                    }}
                                    transition={
                                        reduced || dragging
                                            ? { duration: 0 }
                                            : { type: "spring", stiffness: 145, damping: 25 }
                                    }
                                    style={{ zIndex: focused ? 10 : 1 }}
                                    className="absolute top-[3%] left-1/2 w-[min(420px,65cqh,82cqw)] origin-center -translate-x-1/2 select-none"
                                >
                                    <DestinationStoryCard
                                        board={{
                                            id: String(item.boardId),
                                            title: item.title,
                                            author: item.username,
                                            destination: name,
                                            destinationLabel: countryCode,
                                            description: item.description ?? undefined,
                                            tags: item.tags,
                                            durationDays: item.durationDays,
                                            status: "published",
                                            visibility: "public",
                                            image: item.images[0]
                                                ? {
                                                      src: destinationPhotoUrl(
                                                          new URL(item.images[0].url, apiOrigin).toString(),
                                                          1200
                                                      ),
                                                      alt: item.images[0].alt || item.title,
                                                      unoptimized: true
                                                  }
                                                : undefined
                                        }}
                                        details={focused}
                                        suppressHover={dragging}
                                        imageSizes="(max-width: 768px) 75vw, 420px"
                                        selection={{
                                            selected: focused,
                                            viewHref: `/boards/${item.boardId}`,
                                            onNavigate: (event) => {
                                                if (dragged.current && event.detail !== 0) event.preventDefault();
                                            },
                                            tabIndex: focused ? 0 : -1,
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
                    <div className="relative z-20 flex shrink-0 justify-center py-2">
                        <div className="col-start-2 row-start-1 flex items-center justify-center gap-3">
                            <button
                                type="button"
                                aria-label="Previous slide"
                                disabled={boards.length < 2}
                                onClick={() => select(selected - 1)}
                                className="hover:bg-faint grid size-11 place-items-center focus-visible:outline-2 disabled:opacity-30"
                            >
                                <ArrowLeft size={28} strokeWidth={1.5} />
                            </button>
                            <span className="text-muted-foreground shrink-0 text-sm whitespace-nowrap tabular-nums">
                                {String(selected + 1).padStart(2, "0")} / {String(boards.length).padStart(2, "0")}
                            </span>
                            <button
                                type="button"
                                aria-label="Next slide"
                                disabled={boards.length < 2}
                                onClick={() => select(selected + 1)}
                                className="hover:bg-faint grid size-11 place-items-center focus-visible:outline-2 disabled:opacity-30"
                            >
                                <ArrowRight size={28} strokeWidth={1.5} />
                            </button>
                        </div>
                    </div>
                    <p className="sr-only" aria-live="polite" aria-atomic="true">
                        {board.title}, {board.durationDays} days in {name}. Board {selected + 1} of {boards.length}.
                    </p>
                </div>
            )}
        </section>
    );
}
