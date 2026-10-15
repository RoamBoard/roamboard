"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import { collageBoardExamples, compactBoardExamples } from "@/data/board-card-examples";
import { listPublishedBoards, loadBoardDocument } from "@/lib/board-creator-api";
import { filterGalleryBoards, toGalleryBoard, type GalleryBoard } from "@/lib/my-boards";
import BoardCard from "./cards/BoardCard";
import BoardLibrary from "./BoardLibrary";

const samples: GalleryBoard[] = collageBoardExamples.map((collage, index) => ({
    collage,
    compact: compactBoardExamples[index]
}));

async function readCollection(page: number) {
    const result = await listPublishedBoards(page);
    const boards = await Promise.all(
        result.items.map(async (summary) => toGalleryBoard(summary, await loadBoardDocument(summary.boardId)))
    );
    return { boards, hasMore: result.hasMore };
}

function SpatialGallery({ boards }: { boards: readonly GalleryBoard[] }) {
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
        <section aria-labelledby="featured-boards-heading" className="mx-auto mt-20 max-w-[1320px] md:mt-28">
            <h2
                id="featured-boards-heading"
                className="font-display text-card-subtle text-24 md:text-36 flex justify-between px-5 leading-none font-medium sm:px-12"
            >
                <span>FEATURED</span>
                <span>BOARDS</span>
            </h2>
            <div className="border-line/50 mx-3 mt-6 border-x sm:mx-10">
                <div
                    role="region"
                    aria-roledescription="carousel"
                    aria-label="Your Boards. Use left and right arrow keys to browse."
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
                                    className={`absolute top-0 left-1/2 w-[clamp(244px,34cqw,440px)] origin-center -translate-x-1/2 ${distance ? "hidden sm:block" : ""}`}
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
                            aria-label="Previous Board"
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
                            aria-label="Next Board"
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
        </section>
    );
}

export default function MyBoardsExperience() {
    const [collection, setCollection] = useState<GalleryBoard[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [preview, setPreview] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        const state = { active: true };
        void readCollection(1)
            .then((result) => {
                if (!state.active) return;
                setCollection(result.boards);
                setHasMore(result.hasMore);
                setPage(1);
                setPreview(false);
                setError("");
            })
            .catch((caught: unknown) => {
                if (!state.active) return;
                setCollection(samples);
                setPreview(true);
                setHasMore(false);
                setError(caught instanceof Error ? caught.message : "Your Boards could not be loaded.");
            })
            .finally(() => {
                if (state.active) setLoading(false);
            });
        return () => {
            state.active = false;
        };
    }, [reload]);

    async function loadMore() {
        if (loadingMore) return;
        setLoadingMore(true);
        try {
            const result = await readCollection(page + 1);
            setCollection((current) => [
                ...current,
                ...result.boards.filter(
                    (board) => !current.some((existing) => existing.collage.id === board.collage.id)
                )
            ]);
            setPage(page + 1);
            setHasMore(result.hasMore);
            setError("");
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "More Boards could not be loaded.");
        } finally {
            setLoadingMore(false);
        }
    }

    const matches = filterGalleryBoards(collection, query);
    return (
        <article className="font-body min-w-0 pb-24">
            <header className="px-5 pt-16 text-center md:pt-24">
                <h1 className="font-display text-[clamp(40px,6.4vw,96px)] leading-[1.02] font-bold tracking-[-0.045em]">
                    MY BOARDS
                </h1>
                <p className="text-muted-foreground text-12 md:text-14 mx-auto mt-5 max-w-[560px] leading-snug">
                    Everything you’ve created and saved, all in one place – ready to revisit, edit, remix,
                    <br className="hidden lg:block" /> or pick back up whenever inspiration strikes.
                </p>
                <div className="group border-line focus-within:border-foreground relative mx-auto mt-12 flex min-h-16 max-w-[550px] items-center border-b transition-colors motion-reduce:transition-none md:mt-16 md:min-h-20">
                    <Search
                        aria-hidden="true"
                        size={18}
                        strokeWidth={1.3}
                        className="text-muted-foreground ml-3 shrink-0"
                    />
                    <label htmlFor="board-search" className="sr-only">
                        Search your Boards
                    </label>
                    <input
                        id="board-search"
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="search for a board..."
                        className="text-14 placeholder:text-muted-foreground md:text-20 w-full min-w-0 bg-transparent px-4 py-5 text-center outline-none [&::-webkit-search-cancel-button]:appearance-none"
                    />
                    <button
                        aria-label="Clear Board search"
                        disabled={!query}
                        onClick={() => setQuery("")}
                        className="mr-1 grid size-11 shrink-0 cursor-pointer place-items-center focus-visible:outline-1 disabled:invisible"
                    >
                        <X size={16} strokeWidth={1.3} />
                    </button>
                </div>
            </header>
            <div className="text-10 text-muted-foreground mx-auto mt-6 max-w-xl px-5 text-center">
                {loading ? (
                    <p role="status">Loading your Boards…</p>
                ) : preview ? (
                    <p>
                        Sample collection · your Boards aren’t loaded.{" "}
                        <Link href="/login" className="underline underline-offset-4">
                            Sign in
                        </Link>{" "}
                        or{" "}
                        <button
                            onClick={() => {
                                setLoading(true);
                                setReload((value) => value + 1);
                            }}
                            className="cursor-pointer underline underline-offset-4"
                        >
                            try again
                        </button>
                        .
                    </p>
                ) : (
                    <p>
                        {collection.length} published {collection.length === 1 ? "Board" : "Boards"}
                        {hasMore ? " loaded" : ""}
                    </p>
                )}
                {error && (
                    <details className="mt-2">
                        <summary className="cursor-pointer">
                            {preview ? "Why am I seeing samples?" : "Loading problem"}
                        </summary>
                        <p role="alert" className="mt-2">
                            {error}
                        </p>
                    </details>
                )}
            </div>
            {!loading && matches.length > 0 && (
                <>
                    <SpatialGallery boards={matches.slice(0, 5)} />
                    <BoardLibrary
                        boards={matches}
                        hasMore={!preview && hasMore}
                        loadingMore={loadingMore}
                        onLoadMore={loadMore}
                    />
                </>
            )}
            {!loading && matches.length === 0 && (
                <section className="mx-auto max-w-lg px-5 py-28 text-center">
                    <h2 className="font-display text-30 font-medium">
                        {query.trim() ? "No Boards found." : "Your next journey starts here."}
                    </h2>
                    <p className="text-14 text-muted-foreground mt-4">
                        {query.trim()
                            ? "Try a Board title, destination or country."
                            : "Create a Board and make room for a new memory."}
                    </p>
                    {query.trim() ? (
                        <button
                            onClick={() => setQuery("")}
                            className="text-14 mt-6 cursor-pointer py-3 underline underline-offset-4"
                        >
                            clear search ↗
                        </button>
                    ) : (
                        <Link href="/create" className="text-14 mt-6 inline-block py-3 underline underline-offset-4">
                            create a Board ↗
                        </Link>
                    )}
                </section>
            )}
            {!preview && hasMore && (
                <div className="mt-10 text-center">
                    <button
                        disabled={loadingMore}
                        onClick={() => void loadMore()}
                        className="text-12 cursor-pointer px-5 py-3 underline underline-offset-4 disabled:opacity-50"
                    >
                        {loadingMore ? "Loading…" : "load more Boards ↓"}
                    </button>
                    <p className="text-10 text-muted-foreground mt-2">Search covers the Boards loaded so far.</p>
                </div>
            )}
        </article>
    );
}
