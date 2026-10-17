"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Search, X } from "lucide-react";
import {
    createBoardSelectionStore,
    type BoardSelectionState,
    type BoardSelectionStore
} from "@/lib/board-selection-store";
import { filterSelectionBoards, toSelectionBoard, type SelectionFilter } from "@/lib/board-selection";
import { BoardSelectionCollection, BoardSelectionGallery } from "./BoardSelectionGallery";

type Mode = "continue" | "remix";
const actionClass =
    "focus-visible:outline-foreground min-h-11 cursor-pointer underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-wait disabled:opacity-50";

export default function BoardSelectionExperience({ mode }: { mode: Mode }) {
    const [store] = useState(createBoardSelectionStore);
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    useEffect(() => {
        if (mode === "continue") void store.load();
        return store.cancel;
    }, [mode, store]);
    return <BoardSelectionContent mode={mode} state={state} actions={store} />;
}

export function BoardSelectionContent({
    mode,
    state,
    actions
}: {
    mode: Mode;
    state: BoardSelectionState;
    actions: BoardSelectionStore;
}) {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<SelectionFilter>("all");
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [sharedLink, setSharedLink] = useState("");
    const galleryRef = useRef<HTMLDivElement>(null);
    const reduced = useReducedMotion();
    const remix = mode === "remix";
    const matches = filterSelectionBoards(state.items, query, status);
    const selectedSummary = matches.find((item) => item.boardId === selectedId) ?? matches[0];
    const selected = selectedSummary
        ? toSelectionBoard(selectedSummary, state.documents[selectedSummary.boardId])
        : undefined;
    const recent = matches.slice(0, 5);
    const featuredSummaries =
        selectedSummary && !recent.some((item) => item.boardId === selectedSummary.boardId)
            ? [...recent.slice(0, 4), selectedSummary]
            : recent;
    const featured = featuredSummaries.map((item) => toSelectionBoard(item, state.documents[item.boardId]));
    const featuredIds = new Set(featuredSummaries.map((item) => item.boardId));
    const collection = matches
        .filter((item) => !featuredIds.has(item.boardId))
        .map((item) => toSelectionBoard(item, state.documents[item.boardId]));
    const incomplete = state.scopes.draft.hasMore || state.scopes.published.hasMore;
    const scopeErrors = Object.entries(state.scopes).filter(([, scope]) => scope.error);
    const featuredKey = featuredSummaries.map((item) => item.boardId).join(",");
    useEffect(() => {
        if (remix) return;
        featuredKey
            .split(",")
            .filter(Boolean)
            .forEach((id) => {
                void actions.loadPreview(Number(id));
            });
    }, [actions, featuredKey, remix]);
    async function findSharedBoard() {
        await actions.loadSharedBoard(sharedLink);
        const id = actions.getSnapshot().sharedBoardId;
        if (id === null) return;
        setSelectedId(id);
        setQuery("");
        setStatus("all");
        requestAnimationFrame(() => {
            galleryRef.current?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
            galleryRef.current?.querySelector<HTMLElement>('[role="region"]')?.focus({ preventScroll: true });
        });
    }
    function selectFromCollection(id: number) {
        setSelectedId(id);
        galleryRef.current?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
        galleryRef.current?.querySelector<HTMLElement>('[role="region"]')?.focus({ preventScroll: true });
    }
    return (
        <article className="font-body min-w-0 overflow-x-clip pb-24 sm:pb-40">
            <header className="mx-auto max-w-[1400px] px-5 pt-8 text-center sm:px-10 sm:pt-12">
                <nav
                    aria-label="Create paths"
                    className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-[10px] tracking-[.05em]"
                >
                    <Link href="/create#board-paths" className={actionClass}>
                        ← CREATE
                    </Link>
                    <Link
                        href={remix ? "/create/continue" : "/create/remix"}
                        className={`inline-flex items-center gap-2 ${actionClass}`}
                    >
                        {remix ? "Continue a Board" : "Saved inspiration"}
                        <ArrowUpRight size={13} strokeWidth={1.2} />
                    </Link>
                </nav>
                <p className="text-muted-foreground mt-6 text-[10px] tracking-[.18em] uppercase">
                    {remix ? "Their inspiration, your adventure" : "Pick up wherever you left off"}
                </p>
                <h1 className="font-display mt-4 text-[clamp(2.5rem,6.3vw,6rem)] leading-[.96] font-bold tracking-[-.045em]">
                    {remix ? "YOUR SAVED BOARDS" : "YOUR BOARDS"}
                </h1>
                <p className="text-muted-foreground mx-auto mt-5 max-w-md text-xs leading-relaxed sm:text-sm">
                    {remix
                        ? "Great journeys inspire new ones. Find a Board worth making your own."
                        : "Every journey is a work in progress. Pick up a Board and keep making it yours."}
                </p>
                <div
                    className={`group border-line focus-within:border-foreground relative mx-auto mt-8 flex max-w-md items-center border-b transition-colors motion-reduce:transition-none ${remix ? "opacity-50" : ""}`}
                >
                    <Search aria-hidden="true" size={17} strokeWidth={1.1} className="text-muted-foreground shrink-0" />
                    <label htmlFor="selection-search" className="sr-only">
                        Search {remix ? "saved" : "loaded"} Board titles
                    </label>
                    <input
                        id="selection-search"
                        type="search"
                        value={query}
                        disabled={remix}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={remix ? "saved Board search is coming later" : "search for a board…"}
                        aria-describedby="selection-search-scope"
                        className="placeholder:text-muted-foreground min-h-16 w-full min-w-0 bg-transparent px-3 text-center text-sm outline-none [&::-webkit-search-cancel-button]:appearance-none"
                    />
                    <button
                        type="button"
                        aria-label="Clear Board search"
                        disabled={!query}
                        onClick={() => setQuery("")}
                        className="grid size-11 shrink-0 place-items-center focus-visible:outline-2 disabled:invisible"
                    >
                        <X size={15} strokeWidth={1.2} />
                    </button>
                </div>
                {!remix && (
                    <>
                        <div
                            role="group"
                            aria-label="Filter Boards by publication status"
                            className="mt-2 flex flex-wrap justify-center gap-2"
                        >
                            {(
                                [
                                    ["all", "All Boards"],
                                    ["draft", "Drafts"],
                                    ["published", "Published"]
                                ] as const
                            ).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    aria-pressed={status === value}
                                    onClick={() => setStatus(value)}
                                    className={`focus-visible:outline-foreground min-h-11 cursor-pointer border-b px-4 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none ${status === value ? "border-foreground" : "text-muted-foreground hover:border-line border-transparent"}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <p
                            id="selection-search-scope"
                            role="status"
                            className="text-muted-foreground mx-auto mt-2 max-w-lg text-[10px] leading-relaxed"
                        >
                            {state.loading
                                ? "Gathering your Boards…"
                                : `${matches.length} ${matches.length === 1 ? "Board" : "Boards"}${incomplete ? " loaded" : ""} · title search${incomplete ? " covers loaded pages; load more below to search the rest." : " covers your loaded collection."}`}
                        </p>
                        <details className="text-muted-foreground mx-auto mt-2 max-w-lg text-xs leading-relaxed">
                            <summary className={`inline-flex items-center gap-2 ${actionClass}`}>
                                Have a shared Board link? <ArrowUpRight size={13} />
                            </summary>
                            <p className="mt-3">
                                Your own drafts and published Boards appear here. Shared Boards cannot be listed yet;
                                paste a Board link to check your editing access.
                            </p>
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void findSharedBoard();
                                }}
                                className="mt-4 flex flex-wrap items-center justify-center gap-3"
                            >
                                <label htmlFor="shared-board-link" className="sr-only">
                                    Shared Board link or ID
                                </label>
                                <input
                                    id="shared-board-link"
                                    value={sharedLink}
                                    onChange={(event) => setSharedLink(event.target.value)}
                                    required
                                    placeholder="Board link or ID"
                                    className="border-line focus-visible:outline-foreground min-h-11 min-w-0 flex-1 border-b bg-transparent px-2 text-xs focus-visible:outline-1"
                                />
                                <button type="submit" disabled={state.sharedLoading} className={actionClass}>
                                    {state.sharedLoading ? "Checking…" : "Find Board ↗"}
                                </button>
                            </form>
                            {state.sharedError && (
                                <p role="alert" className="text-foreground mt-3">
                                    {state.sharedError}
                                </p>
                            )}
                        </details>
                    </>
                )}
            </header>
            {remix ? (
                <section
                    aria-labelledby="remix-unavailable"
                    className="border-line mx-auto mt-20 max-w-3xl border-y px-6 py-16 text-center sm:mt-28 sm:py-24"
                >
                    <span className="text-muted-foreground text-[10px] tracking-[.18em] uppercase">
                        A new beginning, coming later
                    </span>
                    <h2 id="remix-unavailable" className="font-display text-30 sm:text-40 mt-5 leading-tight font-bold">
                        Saved inspiration needs a home.
                    </h2>
                    <p className="text-muted-foreground mx-auto mt-5 max-w-md text-sm leading-relaxed">
                        Account-saved Boards aren’t available here yet. When saving and remixing are connected, you’ll
                        be able to browse this collection and start an independent Board of your own.
                    </p>
                    <p
                        id="selection-search-scope"
                        className="text-muted-foreground mx-auto mt-4 max-w-md text-xs leading-relaxed"
                    >
                        Preview bookmarks aren’t an account-saved collection. Remix creation is unavailable, and no
                        original Board will be changed.
                    </p>
                    <button
                        type="button"
                        disabled
                        className="text-muted-foreground mt-10 inline-flex min-h-11 items-center gap-3 text-xs tracking-[.08em] opacity-60"
                    >
                        REMIX THIS BOARD <ArrowUpRight size={17} />
                    </button>
                    <div className="mt-8">
                        <Link href="/discover" className={`text-xs ${actionClass}`}>
                            Explore Roamboard ↗
                        </Link>
                    </div>
                </section>
            ) : (
                <>
                    {scopeErrors.length > 0 && (
                        <div
                            role="alert"
                            className="border-line mx-auto mt-8 max-w-xl border-l px-5 text-xs leading-relaxed"
                        >
                            {scopeErrors.map(([scope, value]) => (
                                <p key={scope} className="mt-2">
                                    {scope === "draft" ? "Drafts" : "Published Boards"} could not be loaded.{" "}
                                    {value.error}
                                </p>
                            ))}
                            <button
                                type="button"
                                onClick={() => void actions.loadMore()}
                                disabled={state.loading || state.loadingMore}
                                className={`mt-3 ${actionClass}`}
                            >
                                Retry unavailable pages
                            </button>
                            <Link href="/login" className={`ml-5 ${actionClass}`}>
                                Sign in
                            </Link>
                        </div>
                    )}
                    {state.loading && (
                        <div
                            role="status"
                            className="text-muted-foreground mx-auto mt-20 flex max-w-5xl items-center justify-center gap-8 px-8 py-20"
                        >
                            <span
                                aria-hidden="true"
                                className="border-line h-48 w-36 border-t border-l motion-safe:animate-pulse"
                            />
                            <p className="text-xs">Making room for your journeys…</p>
                        </div>
                    )}
                    {!state.loading && selected && (
                        <>
                            <div ref={galleryRef} className="scroll-mt-6">
                                <BoardSelectionGallery
                                    boards={featured}
                                    selected={selected}
                                    onSelect={setSelectedId}
                                    error={state.documentErrors[selected.summary.boardId]}
                                    onRetry={() => void actions.loadPreview(selected.summary.boardId)}
                                />
                            </div>
                            <BoardSelectionCollection boards={collection} onSelect={selectFromCollection} />
                        </>
                    )}
                    {!state.loading && !selected && (
                        <motion.section
                            initial={{ opacity: reduced ? 1 : 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: reduced ? 0 : 0.2 }}
                            className="mx-auto max-w-lg px-6 py-24 text-center"
                        >
                            <h2 className="font-display text-30 font-bold">
                                {query || status !== "all"
                                    ? "No matching Boards in view."
                                    : scopeErrors.length
                                      ? "Your collection couldn’t be loaded."
                                      : "There’s a journey waiting to begin."}
                            </h2>
                            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                                {query || status !== "all"
                                    ? `Try another title or publication filter.${incomplete ? " More pages are available below." : ""}`
                                    : scopeErrors.length
                                      ? "Retry the unavailable pages above. Your Boards are still yours."
                                      : "Create a Board, or open a shared Board using its link above."}
                            </p>
                            {query || status !== "all" ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setQuery("");
                                        setStatus("all");
                                    }}
                                    className={`mt-5 text-xs ${actionClass}`}
                                >
                                    Clear search and filters
                                </button>
                            ) : (
                                <Link
                                    href="/boards/new?mode=scratch"
                                    className={`mt-5 inline-flex items-center text-xs ${actionClass}`}
                                >
                                    Create a new Board ↗
                                </Link>
                            )}
                        </motion.section>
                    )}
                    {!state.loading && incomplete && (
                        <div className="mx-auto mt-12 max-w-md px-5 text-center">
                            <button
                                type="button"
                                disabled={state.loadingMore}
                                onClick={() => void actions.loadMore()}
                                className={`text-sm ${actionClass}`}
                            >
                                {state.loadingMore ? "Loading more Boards…" : "Load more Boards ↓"}
                            </button>
                            <p className="text-muted-foreground mt-3 text-[10px] leading-relaxed">
                                Search and filters include loaded pages only. Keep loading to explore the rest.
                            </p>
                        </div>
                    )}
                </>
            )}
        </article>
    );
}
