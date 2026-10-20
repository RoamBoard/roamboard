"use client";

import ViewAllBoards from "./ViewAllBoards";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { selectionEditorHref, type SelectionBoard } from "@/lib/board-selection";
import PhotoBoardCard from "./cards/PhotoBoardCard";
import AccountPhotoBoardCard from "./cards/AccountPhotoBoardCard";

const spring = { type: "spring" as const, stiffness: 150, damping: 25, mass: 0.85 };
const focusClass = "focus-visible:outline-foreground focus-visible:outline-2 focus-visible:outline-offset-4";

export function BoardSelectionGallery({
    boards,
    selected,
    onSelect,
    error,
    onRetry,
    mode = "continue",
    compact = false,
    onSavedChange
}: {
    boards: SelectionBoard[];
    selected: SelectionBoard;
    onSelect: (id: number) => void;
    error?: string;
    onRetry: () => void;
    mode?: "continue" | "remix" | "explore";
    compact?: boolean;
    onSavedChange?: (boardId: number, saved: boolean) => void;
}) {
    const reduced = useReducedMotion();
    const dragged = useRef(false);
    const dragTarget = useRef<number | null>(null);
    const [draggedCardId, setDraggedCardId] = useState<number | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const selectedIndex = boards.findIndex((board) => board.summary.boardId === selected.summary.boardId);
    const rest = boards.filter((board) => board.summary.boardId !== selected.summary.boardId);
    const visibleBoards = [selected, ...rest.slice(0, 4)];
    const positions = new Map(rest.map((board, index) => [board.summary.boardId, index]));
    const href = selected.previewResolved
        ? (selected.editHref ??
          (mode === "remix" && selected.photo.status === "published" ? `/boards/${selected.summary.boardId}` : null))
        : selected.document
          ? mode === "remix"
              ? `/boards/${selected.summary.boardId}`
              : selectionEditorHref(selected.document)
          : null;
    const selectOffset = (offset: number) => {
        const next = boards[(selectedIndex + offset + boards.length) % boards.length];
        if (next) onSelect(next.summary.boardId);
    };
    return (
        <section
            aria-label={mode === "continue" ? "Your Boards" : mode === "remix" ? "Saved Boards" : "Published Boards"}
            className={`mx-auto mt-12 max-w-[1400px] px-4 sm:mt-16 sm:px-10 lg:px-16 ${compact ? "selection-gallery" : ""}`}
        >
            <div
                role="region"
                aria-roledescription="carousel"
                aria-label="Featured Boards"
                tabIndex={0}
                className={`@container relative ${focusClass}`}
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
                <motion.div
                    style={{ touchAction: "pan-y" }}
                    onPointerDown={(event) => {
                        dragged.current = false;
                        const card = (event.target as HTMLElement).closest?.("[data-selection-card]");
                        dragTarget.current = card ? Number(card.getAttribute("data-selection-card")) : null;
                    }}
                    onPan={(_, info) => {
                        if (dragTarget.current === null) return;
                        dragged.current = true;
                        setDragging(true);
                        setDraggedCardId(dragTarget.current);
                        setDragOffset(info.offset);
                    }}
                    onPanEnd={(_, info) => {
                        if (dragTarget.current !== null && Math.hypot(info.offset.x, info.offset.y) > 30) {
                            if (dragTarget.current === selected.summary.boardId)
                                selectOffset(info.offset.x < 0 ? 1 : -1);
                            else onSelect(dragTarget.current);
                        }
                        setDragOffset({ x: 0, y: 0 });
                        setDragging(false);
                    }}
                    onPointerCancel={() => {
                        setDragOffset({ x: 0, y: 0 });
                        setDragging(false);
                    }}
                    className={`relative h-[min(calc(110cqw+4rem),36rem)] min-h-[320px] cursor-grab overflow-clip select-none active:cursor-grabbing sm:h-[min(calc(60cqw+4rem),36rem)] lg:h-[min(calc(45cqw+4rem),36rem)] ${compact ? "selection-stage" : ""}`}
                >
                    {visibleBoards.map((board) => {
                        const active = board.summary.boardId === selected.summary.boardId;
                        const position = positions.get(board.summary.boardId) ?? 0;
                        return (
                            <motion.div
                                key={board.summary.boardId}
                                data-selection-card={board.summary.boardId}
                                initial={reduced ? false : { opacity: 0 }}
                                animate={{
                                    x: draggedCardId === board.summary.boardId ? dragOffset.x : 0,
                                    y: draggedCardId === board.summary.boardId ? dragOffset.y : 0,
                                    left: active ? "0%" : `${65 + position * 5}%`,
                                    top: active ? "2%" : `${11 + position * 4}%`,
                                    scale: active ? 1 : 0.68 - position * 0.045,
                                    rotate: reduced || active ? 0 : -3 + position * 2.5,
                                    opacity: 1
                                }}
                                transition={
                                    reduced || (dragging && draggedCardId === board.summary.boardId)
                                        ? { duration: 0 }
                                        : spring
                                }
                                style={{
                                    zIndex:
                                        dragging && draggedCardId === board.summary.boardId
                                            ? 40
                                            : active
                                              ? 20
                                              : 10 - position,
                                    transformOrigin: "top left"
                                }}
                                className={`absolute ml-[6cqw] w-[min(400px,88cqw)] sm:ml-0 sm:w-[min(400px,48cqw)] lg:w-[min(400px,36cqw)] ${!active ? "hidden sm:block" : ""} ${compact ? "selection-card" : ""}`}
                            >
                                <>
                                    <AccountPhotoBoardCard
                                        tilt
                                        showVisibility
                                        hideCoverCredit
                                        suppressHover={dragging}
                                        board={board.photo}
                                        ownership={board.ownership}
                                        details={active && Boolean(board.document || board.previewResolved)}
                                        initialSaved={board.savedByMe}
                                        onSavedChange={(saved) => onSavedChange?.(board.summary.boardId, saved)}
                                        imageSizes="(max-width: 640px) 80vw, 400px"
                                        selection={{
                                            selected: active,
                                            href: active ? (href ?? undefined) : undefined,
                                            viewHref:
                                                board.photo.status === "published"
                                                    ? `/boards/${board.summary.boardId}`
                                                    : board.document
                                                      ? (selectionEditorHref(board.document) ?? undefined)
                                                      : board.editHref,
                                            remixHref:
                                                active && mode === "remix" && href
                                                    ? `/boards/new?remix=${board.summary.boardId}`
                                                    : undefined,
                                            onNavigate: (event) => {
                                                if (dragged.current && event.detail !== 0) event.preventDefault();
                                            },
                                            label: `Focus ${board.photo.title}`,
                                            tabIndex: active ? 0 : -1,
                                            onSelect: (event) => {
                                                if (!dragged.current || event.detail === 0)
                                                    onSelect(board.summary.boardId);
                                                else event.preventDefault();
                                            }
                                        }}
                                    />
                                    {board.previewResolved && (
                                        <p className="text-muted-foreground mt-3 text-center text-xs">
                                            {board.summary.status === "draft" ? "Draft" : "Published"}
                                        </p>
                                    )}
                                    {!board.document && !board.previewResolved && active && (
                                        <p
                                            role="status"
                                            className="text-muted-foreground mt-3 max-w-full text-xs leading-relaxed"
                                        >
                                            {error
                                                ? "Preview unavailable. Retry access below."
                                                : mode === "remix"
                                                  ? "Loading saved Board preview..."
                                                  : "Loading Board preview and edit access…"}
                                        </p>
                                    )}
                                </>
                            </motion.div>
                        );
                    })}
                    <div
                        className={`absolute top-[5%] left-[calc(min(400px,36cqw)+3cqw)] z-30 hidden w-[22cqw] lg:block ${compact ? "selection-annotations" : ""}`}
                    >
                        <SelectionAnnotations board={selected} />
                    </div>
                    <div
                        role="group"
                        aria-label="Board selection controls"
                        className="absolute right-0 bottom-0 z-30 flex w-full items-center justify-center gap-3 sm:bottom-[8%] sm:w-[35%]"
                    >
                        <button
                            type="button"
                            aria-label="Previous Board"
                            disabled={boards.length < 2}
                            onClick={() => selectOffset(-1)}
                            className={`hover:bg-faint grid size-11 cursor-pointer place-items-center disabled:opacity-25 ${focusClass}`}
                        >
                            <ArrowLeft size={28} strokeWidth={1.5} />
                        </button>
                        <span className="text-muted-foreground text-sm tabular-nums">
                            {String(selectedIndex + 1).padStart(2, "0")} / {String(boards.length).padStart(2, "0")}
                        </span>
                        <button
                            type="button"
                            aria-label="Next Board"
                            disabled={boards.length < 2}
                            onClick={() => selectOffset(1)}
                            className={`hover:bg-faint grid size-11 cursor-pointer place-items-center disabled:opacity-25 ${focusClass}`}
                        >
                            <ArrowRight size={28} strokeWidth={1.5} />
                        </button>
                    </div>
                </motion.div>
                <div
                    className={`border-line relative z-30 flex flex-col items-center gap-3 py-3 sm:flex-row ${boards.length > 1 ? "border-b" : ""}`}
                >
                    {!href && !selected.previewResolved && (
                        <span className="text-muted-foreground text-xs">
                            {mode === "remix"
                                ? error
                                    ? "Saved Board unavailable"
                                    : "Checking saved Board access..."
                                : error || selected.document
                                  ? "Editing unavailable"
                                  : "Checking edit access..."}
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
    const activities = board.document?.days.reduce((count, day) => count + day.activities.length, 0);
    const status = board.document?.status ?? board.summary.status;
    const visibility = board.document?.visibility ?? board.photo.visibility;
    const visibilityText =
        status === "draft"
            ? "Only you"
            : visibility
              ? {
                    public: "Public",
                    friends: "Friends",
                    collaborators: "Restricted access"
                }[visibility]
              : undefined;
    const savedCount = board.photo.savedCount;
    const hasSaves = savedCount !== undefined && Number.isSafeInteger(savedCount) && savedCount >= 0;
    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.dl
                key={board.summary.boardId}
                initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.16 }}
                className="text-muted-foreground grid grid-cols-2 gap-5 text-sm leading-relaxed sm:text-base lg:grid-cols-1 lg:gap-5"
            >
                <div>
                    <dt className="text-foreground text-xs tracking-[.08em] uppercase">
                        {board.summary.source === "saved"
                            ? "Saved Board"
                            : board.ownership === "owner"
                              ? "Your Board"
                              : board.previewResolved
                                ? "Community Board"
                                : "Shared with you"}
                    </dt>
                    <dd className="mt-1">{visibilityText}</dd>
                </div>
                <div>
                    <dt className="text-foreground text-xs tracking-[.08em] uppercase">
                        {board.summary.source === "saved"
                            ? "Saved on"
                            : board.firstPublishedAt && board.summary.source === "shared"
                              ? "Published"
                              : "Last updated"}
                    </dt>
                    <dd className="mt-1">
                        {formatSelectionDate(
                            board.summary.source === "shared" && board.firstPublishedAt
                                ? board.firstPublishedAt
                                : board.summary.updatedAt
                        )}
                    </dd>
                </div>
                {board.destination && (
                    <div>
                        <dt className="text-foreground text-xs tracking-[.08em] uppercase">Destination</dt>
                        <dd className="mt-1 break-words">{board.destination}</dd>
                    </div>
                )}
                {board.document && (
                    <div>
                        <dt className="text-foreground text-xs tracking-[.08em] uppercase">In this Board</dt>
                        <dd className="mt-1">
                            {board.document.days.length} {board.document.days.length === 1 ? "day" : "days"} ·{" "}
                            {activities} {activities === 1 ? "activity" : "activities"}
                        </dd>
                    </div>
                )}
                {hasSaves && (
                    <div>
                        <dt className="text-foreground text-xs tracking-[.08em] uppercase">Saves received</dt>
                        <dd className="mt-1">
                            {new Intl.NumberFormat("en-US").format(savedCount)} {savedCount === 1 ? "save" : "saves"}
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
    onSelect,
    mode = "continue",
    viewAllHref,
    id = "selection-collection-heading"
}: {
    boards: SelectionBoard[];
    onSelect: (id: number) => void;
    mode?: "continue" | "remix" | "explore";
    id?: string;
    viewAllHref?: string;
}) {
    const reduced = useReducedMotion();
    if (!boards.length) return null;
    return (
        <section
            aria-labelledby={id}
            className="border-line mx-auto mt-16 max-w-[1272px] border-t px-4 pt-12 sm:mt-24 sm:px-10 sm:pt-16"
        >
            <div className="flex items-center justify-between gap-5">
                <h2 id={id} className="font-display text-muted-foreground/65 text-30 sm:text-40 leading-none font-bold">
                    THE COLLECTION
                </h2>
                {viewAllHref && <ViewAllBoards href={viewAllHref} />}
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
                        <div
                            className={`relative mx-auto max-w-60 ${mode === "remix" ? "" : "transition-transform duration-300 focus-within:-translate-y-2 hover:-translate-y-2 motion-reduce:transform-none motion-reduce:transition-none"}`}
                        >
                            <PhotoBoardCard
                                tilt
                                showVisibility
                                hideCoverCredit
                                board={board.photo}
                                ownership={board.ownership}
                                details={mode !== "remix"}
                                imageSizes="(max-width: 640px) 75vw, 240px"
                                selection={{
                                    selected: false,
                                    viewHref:
                                        board.photo.status === "published"
                                            ? `/boards/${board.summary.boardId}`
                                            : board.document
                                              ? (selectionEditorHref(board.document) ?? undefined)
                                              : undefined,
                                    label: `Focus ${board.photo.title} from collection`,
                                    onSelect: () => onSelect(board.summary.boardId)
                                }}
                            />
                        </div>

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
