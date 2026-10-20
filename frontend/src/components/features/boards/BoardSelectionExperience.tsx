"use client";

import ViewAllBoards from "./ViewAllBoards";
import { collectionHref } from "@/lib/board-collections";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import {
    createBoardSelectionStore,
    type BoardSelectionState,
    type BoardSelectionStore
} from "@/lib/board-selection-store";
import { filterSelectionBoards, toSelectionBoard, type SelectionFilter } from "@/lib/board-selection";
import { BoardSelectionCollection, BoardSelectionGallery } from "./BoardSelectionGallery";
import styles from "./BoardSelectionExperience.module.css";

type Mode = "continue" | "remix";
const actionClass =
    "focus-visible:outline-foreground min-h-11 cursor-pointer underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-wait disabled:opacity-50";

export default function BoardSelectionExperience({ mode }: { mode: Mode }) {
    const [store] = useState(() => createBoardSelectionStore(undefined, mode));
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    useEffect(() => {
        void store.load();
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
    const [status, setStatus] = useState<Exclude<SelectionFilter, "all">>("published");
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const galleryRef = useRef<HTMLDivElement>(null);
    const reduced = useReducedMotion();
    const remix = mode === "remix";
    const matches = filterSelectionBoards(
        state.items.filter((item) => item.source === (remix ? "saved" : "owned")),
        "",
        remix ? "published" : status
    );
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
    const incomplete = state.scopes[status].hasMore;
    const scopeErrors = Object.entries(state.scopes).filter(([, scope]) => scope.error);
    const featuredKey = featuredSummaries.map((item) => item.boardId).join(",");
    useEffect(() => {
        featuredKey
            .split(",")
            .filter(Boolean)
            .forEach((id) => {
                void actions.loadPreview(Number(id));
            });
    }, [actions, featuredKey, remix]);
    function selectFromCollection(id: number) {
        setSelectedId(id);
        galleryRef.current?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
        galleryRef.current?.querySelector<HTMLElement>('[role="region"]')?.focus({ preventScroll: true });
    }
    return (
        <article className={`font-body min-w-0 overflow-x-clip pb-24 sm:pb-40 ${styles.page}`}>
            <header className={`mx-auto max-w-[1400px] px-5 pt-8 text-center sm:px-10 sm:pt-12 ${styles.header}`}>
                <h1 className="font-display mt-4 text-[clamp(2.5rem,6.3vw,6rem)] leading-[.96] font-bold tracking-[-.045em]">
                    {remix ? "SAVED BOARDS" : "YOUR BOARDS"}
                </h1>
                <p className="text-foreground mt-4 text-sm">
                    {remix ? "Their Board, your adventure" : "Pick up wherever you left off"}
                </p>
                <p className="text-muted-foreground mx-auto mt-5 max-w-md text-xs leading-relaxed sm:text-sm">
                    {remix
                        ? "Use a saved Board as a starting point for your own trip."
                        : "Edit your published Boards or continue a draft."}
                </p>
                <div
                    role={remix ? undefined : "group"}
                    aria-label={remix ? undefined : "Filter Boards by publication status"}
                    aria-hidden={remix || undefined}
                    className={`mt-6 flex min-h-11 flex-wrap justify-center gap-2 ${styles.filterRow}`}
                >
                    {!remix &&
                        (
                            [
                                ["published", "Published"],
                                ["draft", "Drafts"]
                            ] as const
                        ).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={status === value}
                                onClick={() => setStatus(value)}
                                className={`focus-visible:outline-foreground min-h-11 cursor-pointer border-b px-5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none ${status === value ? "border-foreground" : "text-muted-foreground hover:border-line border-transparent"}`}
                            >
                                {label}
                            </button>
                        ))}
                </div>
                <p
                    role="status"
                    className="text-muted-foreground relative top-5 mx-auto mt-2 max-w-lg text-xs leading-relaxed"
                >
                    {state.loading
                        ? remix
                            ? "Gathering your saved Boards..."
                            : "Gathering your Boards…"
                        : remix
                          ? `${matches.length} saved ${matches.length === 1 ? "Board" : "Boards"}${incomplete ? " loaded" : ""}`
                          : `${matches.length} ${status === "draft" ? (matches.length === 1 ? "draft" : "drafts") : matches.length === 1 ? "published Board" : "published Boards"}${incomplete ? " loaded" : ""}`}
                </p>
                <div className="mx-auto flex max-w-[1320px] justify-end">
                    <ViewAllBoards href={collectionHref(remix ? "saved" : "mine", remix ? {} : { status })} />
                </div>
            </header>
            <div className={styles.content}>
                {scopeErrors.length > 0 && (
                    <div
                        role="alert"
                        className="border-line mx-auto mt-8 max-w-xl border-l px-5 text-xs leading-relaxed"
                    >
                        {scopeErrors.map(([scope, value]) => (
                            <p key={scope} className="mt-2">
                                {remix ? "Saved Boards" : scope === "draft" ? "Drafts" : "Published Boards"} could not
                                be loaded. {value.error}
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
                                compact
                                mode={mode}
                                boards={featured}
                                selected={selected}
                                onSelect={setSelectedId}
                                error={state.documentErrors[selected.summary.boardId]}
                                onRetry={() => void actions.loadPreview(selected.summary.boardId)}
                            />
                        </div>
                        <BoardSelectionCollection
                            viewAllHref={collectionHref(remix ? "saved" : "mine", remix ? {} : { status })}
                            boards={collection}
                            onSelect={selectFromCollection}
                            mode={mode}
                        />
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
                            {state.scopes[status].error
                                ? "Your collection could not be loaded."
                                : remix
                                  ? "No saved Boards yet."
                                  : status === "draft"
                                    ? "No drafts here yet."
                                    : "No published Boards here yet."}
                        </h2>
                        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                            {state.scopes[status].error
                                ? "Retry the unavailable pages above. Your Boards are still yours."
                                : incomplete
                                  ? "Load more Boards below, or switch the publication filter."
                                  : remix
                                    ? "Save a Board to start making it your own."
                                    : "Switch the publication filter, or create a new Board."}
                        </p>
                        <Link
                            href="/boards/new?mode=scratch"
                            className={`mt-5 inline-flex items-center text-xs ${actionClass}`}
                        >
                            Create a new Board <ArrowUpRight aria-hidden="true" size={13} className="ml-2" />
                        </Link>
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
                            More Boards are available. Keep loading to explore the rest.
                        </p>
                    </div>
                )}
            </div>
        </article>
    );
}
