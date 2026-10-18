"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { selectionEditorHref, type SelectionBoard } from "@/lib/board-selection";
import PhotoBoardCard from "./cards/PhotoBoardCard";

const spring = { type: "spring" as const, stiffness: 150, damping: 25, mass: 0.85 };
const focusClass = "focus-visible:outline-foreground focus-visible:outline-2 focus-visible:outline-offset-4";

function TactileBoard({ children, active = true }: { children: ReactNode; active?: boolean }) {
    const reduced = useReducedMotion();
    const bounds = useRef<DOMRect | null>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotateX = useSpring(x, { stiffness: 220, damping: 25 });
    const rotateY = useSpring(y, { stiffness: 220, damping: 25 });
    return (
        <motion.div
            className="relative [transform-style:preserve-3d]"
            style={{ rotateX: reduced ? 0 : rotateX, rotateY: reduced ? 0 : rotateY, transformPerspective: 1200 }}
            onPointerEnter={(event) => {
                if (active && !reduced && event.pointerType === "mouse")
                    bounds.current = event.currentTarget.getBoundingClientRect();
            }}
            onPointerMove={(event) => {
                const rect = bounds.current;
                if (!rect || reduced || !active || event.pointerType !== "mouse") return;
                x.set(-((event.clientY - rect.top) / rect.height - 0.5) * 3);
                y.set(((event.clientX - rect.left) / rect.width - 0.5) * 4);
            }}
            onPointerLeave={() => {
                bounds.current = null;
                x.set(0);
                y.set(0);
            }}
        >
            {children}
        </motion.div>
    );
}

export function BoardSelectionGallery({
    boards,
    selected,
    onSelect,
    error,
    onRetry,
    mode = "continue"
}: {
    boards: SelectionBoard[];
    selected: SelectionBoard;
    onSelect: (id: number) => void;
    error?: string;
    onRetry: () => void;
    mode?: "continue" | "remix";
}) {
    const reduced = useReducedMotion();
    const selectedIndex = boards.findIndex((board) => board.summary.boardId === selected.summary.boardId);
    const rest = boards.filter((board) => board.summary.boardId !== selected.summary.boardId);
    const positions = new Map(rest.map((board, index) => [board.summary.boardId, index]));
    const href = selected.document ? selectionEditorHref(selected.document) : null;
    const selectOffset = (offset: number) => {
        const next = boards[(selectedIndex + offset + boards.length) % boards.length];
        if (next) onSelect(next.summary.boardId);
    };
    return (
        <section
            aria-labelledby="selection-recent-heading"
            className="mx-auto mt-12 max-w-[1400px] px-4 sm:mt-16 sm:px-10 lg:px-16"
        >
            <div className="flex items-end justify-between gap-4">
                <h2
                    id="selection-recent-heading"
                    className="font-display text-muted-foreground/65 text-30 sm:text-40 leading-[.9] font-bold"
                >
                    {mode === "continue" ? (
                        <>
                            RECENTLY
                            <br />
                            UPDATED
                        </>
                    ) : (
                        <>
                            RECENTLY
                            <br />
                            SAVED
                        </>
                    )}
                </h2>
                <p className="text-muted-foreground max-w-36 text-right text-[10px] leading-relaxed sm:max-w-none">
                    Select a Board. Make room for what’s next.
                </p>
            </div>
            <div
                role="region"
                aria-roledescription="carousel"
                aria-label="Featured Boards"
                tabIndex={0}
                className={`@container relative mt-8 ${focusClass}`}
                onKeyDown={(event) => {
                    if (
                        event.target !== event.currentTarget &&
                        !(event.target instanceof Element && event.target.closest("[data-board-selection]"))
                    )
                        return;
                    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                        event.preventDefault();
                        event.currentTarget.focus({ preventScroll: true });
                        if (event.key === "Home") onSelect(boards[0].summary.boardId);
                        else if (event.key === "End") onSelect(boards.at(-1)!.summary.boardId);
                        else selectOffset(event.key === "ArrowRight" ? 1 : -1);
                    }
                }}
            >
                <div className="relative h-[min(calc(110cqw+4rem),36rem)] min-h-[320px] overflow-clip sm:h-[min(calc(60cqw+4rem),36rem)] lg:h-[min(calc(45cqw+4rem),36rem)]">
                    {boards.map((board) => {
                        const active = board.summary.boardId === selected.summary.boardId;
                        const position = positions.get(board.summary.boardId) ?? 0;
                        return (
                            <motion.div
                                key={board.summary.boardId}
                                initial={reduced ? false : { opacity: 0 }}
                                animate={{
                                    left: active ? "0%" : `${65 + position * 5}%`,
                                    top: active ? "2%" : `${11 + position * 4}%`,
                                    scale: active ? 1 : 0.68 - position * 0.045,
                                    rotate: reduced || active ? 0 : -3 + position * 2.5,
                                    opacity: 1
                                }}
                                transition={reduced ? { duration: 0 } : spring}
                                style={{ zIndex: active ? 20 : 10 - position, transformOrigin: "top left" }}
                                className={`absolute ml-[6cqw] w-[min(400px,88cqw)] sm:ml-0 sm:w-[min(400px,48cqw)] lg:w-[min(400px,36cqw)] ${!active ? "hidden sm:block" : ""}`}
                            >
                                <TactileBoard active={active}>
                                    <PhotoBoardCard
                                        board={board.photo}
                                        ownership={board.ownership}
                                        details={active && Boolean(board.document)}
                                        imageSizes="(max-width: 640px) 80vw, 400px"
                                        selection={{
                                            selected: active,
                                            label: `Focus ${board.photo.title}`,
                                            tabIndex: active ? 0 : -1,
                                            onSelect: () => onSelect(board.summary.boardId)
                                        }}
                                    />
                                    {!board.document && active && (
                                        <p
                                            role="status"
                                            className="text-muted-foreground mt-3 max-w-full text-xs leading-relaxed"
                                        >
                                            {error
                                                ? "Preview unavailable. Retry access below."
                                                : "Loading Board preview and edit access…"}
                                        </p>
                                    )}
                                </TactileBoard>
                            </motion.div>
                        );
                    })}
                    <span
                        aria-hidden="true"
                        className="bg-line pointer-events-none absolute top-[calc(25%+5px)] left-[min(400px,36cqw)] hidden h-px w-[3cqw] lg:block"
                    />
                    <div className="absolute top-[25%] left-[calc(min(400px,36cqw)+3cqw)] z-30 hidden w-[22cqw] lg:block">
                        <SelectionAnnotations board={selected} />
                    </div>
                    <span
                        aria-hidden="true"
                        className="text-muted-foreground/30 absolute right-5 bottom-8 hidden text-[10px] tracking-[.18em] uppercase sm:block"
                    >
                        a journey, still unfolding
                    </span>
                </div>
                <div className="border-line relative z-30 flex flex-wrap items-center justify-between gap-3 border-t py-4">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            aria-label="Previous Board"
                            disabled={boards.length < 2}
                            onClick={() => selectOffset(-1)}
                            className={`hover:bg-faint grid size-11 cursor-pointer place-items-center disabled:opacity-25 ${focusClass}`}
                        >
                            <ArrowLeft size={18} strokeWidth={1.2} />
                        </button>
                        <span className="text-muted-foreground text-[10px] tabular-nums">
                            {String(selectedIndex + 1).padStart(2, "0")} / {String(boards.length).padStart(2, "0")}
                        </span>
                        <button
                            type="button"
                            aria-label="Next Board"
                            disabled={boards.length < 2}
                            onClick={() => selectOffset(1)}
                            className={`hover:bg-faint grid size-11 cursor-pointer place-items-center disabled:opacity-25 ${focusClass}`}
                        >
                            <ArrowRight size={18} strokeWidth={1.2} />
                        </button>
                    </div>
                    {mode === "continue" && href ? (
                        <Link
                            href={href}
                            className={`group ml-auto inline-flex min-h-11 items-center gap-4 py-3 text-xs tracking-[.08em] underline underline-offset-8 ${focusClass}`}
                        >
                            CONTINUE BOARD{" "}
                            <ArrowUpRight
                                size={18}
                                strokeWidth={1.2}
                                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                            />
                        </Link>
                    ) : (
                        <span className="text-muted-foreground text-xs">
                            {mode === "remix"
                                ? "Remixing is coming later"
                                : error || selected.document
                                  ? "Editing unavailable"
                                  : "Checking edit access…"}
                        </span>
                    )}
                </div>
                <div className="pt-4 lg:hidden">
                    <SelectionAnnotations board={selected} />
                </div>
                <p aria-live="polite" aria-atomic="true" className="sr-only">
                    {selected.photo.title}. {selected.photo.status === "draft" ? "Draft" : "Published"}. Board{" "}
                    {selectedIndex + 1} of {boards.length}.
                </p>
                {error && (
                    <div role="alert" className="border-line mt-5 border-l pl-4 text-xs leading-relaxed">
                        <p>{error}</p>
                        <button
                            type="button"
                            onClick={onRetry}
                            className={`mt-2 min-h-11 underline underline-offset-4 ${focusClass}`}
                        >
                            Retry access and preview
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}

function SelectionAnnotations({ board }: { board: SelectionBoard }) {
    const reduced = useReducedMotion();
    const activities = board.document?.days.reduce((count, day) => count + day.activities.length, 0) ?? 0;
    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.dl
                key={board.summary.boardId}
                initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.16 }}
                className="text-muted-foreground grid grid-cols-2 gap-5 text-xs leading-relaxed lg:grid-cols-1 lg:gap-8"
            >
                <div>
                    <dt className="text-foreground text-[10px] tracking-[.1em] uppercase">
                        {board.ownership === "owner" ? "Your Board" : "Shared with you"}
                    </dt>
                    <dd className="mt-1">
                        {board.summary.status === "draft"
                            ? "Unpublished draft"
                            : board.ownership === "owner"
                              ? "Published · still yours to shape"
                              : "Published · editing access"}
                    </dd>
                </div>
                <div>
                    <dt className="text-foreground text-[10px] tracking-[.1em] uppercase">Last updated</dt>
                    <dd className="mt-1">{formatSelectionDate(board.summary.updatedAt)}</dd>
                </div>
                {board.destination && (
                    <div>
                        <dt className="text-foreground text-[10px] tracking-[.1em] uppercase">Destination</dt>
                        <dd className="mt-1 break-words">{board.destination}</dd>
                    </div>
                )}
                {board.document && (
                    <div>
                        <dt className="text-foreground text-[10px] tracking-[.1em] uppercase">In this Board</dt>
                        <dd className="mt-1">
                            {board.document.days.length} {board.document.days.length === 1 ? "day" : "days"} ·{" "}
                            {activities} {activities === 1 ? "activity" : "activities"}
                        </dd>
                    </div>
                )}
            </motion.dl>
        </AnimatePresence>
    );
}

export function formatSelectionDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "Date unavailable"
        : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
              date
          );
}

export function BoardSelectionCollection({
    boards,
    onSelect
}: {
    boards: SelectionBoard[];
    onSelect: (id: number) => void;
}) {
    const reduced = useReducedMotion();
    if (!boards.length) return null;
    return (
        <section
            aria-labelledby="selection-collection-heading"
            className="border-line mx-auto mt-16 max-w-[1272px] border-t px-4 pt-12 sm:mt-24 sm:px-10 sm:pt-16"
        >
            <div className="flex items-end justify-between gap-5">
                <h2
                    id="selection-collection-heading"
                    className="font-display text-muted-foreground/65 text-30 sm:text-40 leading-none font-bold"
                >
                    THE COLLECTION
                </h2>
                <span className="text-muted-foreground text-[10px]">Bring a Board into focus ↗</span>
            </div>
            <motion.ul
                layout={!reduced}
                className="mt-10 grid grid-cols-1 gap-y-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            >
                {boards.map((board, index) => (
                    <motion.li
                        key={board.summary.boardId}
                        layout={!reduced}
                        transition={reduced ? { duration: 0 } : spring}
                        className={`border-line relative border-r border-b px-5 py-8 sm:px-7 sm:py-10 ${index % 2 ? "lg:pt-20" : ""}`}
                    >
                        <TactileBoard>
                            <div className="relative mx-auto max-w-60 transition-transform duration-300 focus-within:-translate-y-2 hover:-translate-y-2 motion-reduce:transform-none motion-reduce:transition-none">
                                <PhotoBoardCard
                                    board={board.photo}
                                    ownership={board.ownership}
                                    details
                                    imageSizes="(max-width: 640px) 75vw, 240px"
                                    selection={{
                                        selected: false,
                                        label: `Focus ${board.photo.title} from collection`,
                                        onSelect: () => onSelect(board.summary.boardId)
                                    }}
                                />
                            </div>
                        </TactileBoard>
                        <div className="text-muted-foreground mx-auto mt-4 flex max-w-60 flex-wrap justify-between gap-2 text-[10px]">
                            <span>{board.summary.status === "draft" ? "Draft" : "Published"}</span>
                            <time dateTime={board.summary.updatedAt}>
                                {formatSelectionDate(board.summary.updatedAt)}
                            </time>
                        </div>
                    </motion.li>
                ))}
            </motion.ul>
        </section>
    );
}
