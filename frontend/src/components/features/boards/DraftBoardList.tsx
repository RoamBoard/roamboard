"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { createDraftBoardsStore, filterDraftBoards, type DraftBoardsState } from "@/lib/draft-boards-store";
import { fromBoardDocument, type BoardDocument, type DraftSummary } from "@/lib/board-creator-api";
import { createBoardPreview } from "@/lib/board-creation-preview";
import { boardTitleLines } from "@/lib/my-boards";
import CollageBoardCard from "./cards/CollageBoardCard";
import { BoardCardGraphic, BoardCardPhoto, BoardCardTitle } from "./cards/BoardCardParts";

const actionClass =
    "min-h-11 inline-flex items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-40";

function savedDate(value: string) {
    const date = new Date(value);
    return Number.isFinite(date.valueOf())
        ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
              date
          )
        : "Date unavailable";
}

function DraftCollage({ document }: { document: BoardDocument }) {
    const restored = fromBoardDocument(document);
    const preview = createBoardPreview({
        title: document.title,
        description: document.description ?? "",
        status: "draft",
        visibility: document.visibility,
        coverImageId: document.coverImageId,
        tags: document.tags.map((tag) => tag.name),
        days: restored.days,
        images: restored.images
    });
    return (
        <CollageBoardCard
            board={{ ...preview.card, id: String(document.boardId) }}
            preview
            href={`/boards/drafts/${document.boardId}`}
        />
    );
}

// Summary-only tiles keep the library light: no document fetch or invented country/author data.
function DraftTile({ item }: { item: DraftSummary }) {
    const title = item.title.trim() || "Untitled Board";
    const summary = {
        id: String(item.boardId),
        title,
        titleLines: boardTitleLines(title, 10).map((line) => line.replace(/[\uD800-\uDBFF](?=…|$)/g, "")),
        author: "",
        destination: "",
        destinationLabel: ""
    };
    const cover = item.coverImageUrl
        ? new URL(item.coverImageUrl, process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").toString()
        : null;
    return (
        <Link
            href={`/boards/drafts/${item.boardId}`}
            aria-label={`Edit draft: ${title}`}
            className="group mx-auto block w-full max-w-[180px] focus-visible:outline-2 focus-visible:outline-offset-8"
        >
            <div className="@container relative aspect-[180/340] transition-transform duration-200 motion-safe:group-hover:-translate-y-1 motion-reduce:transition-none">
                {cover ? (
                    <BoardCardPhoto
                        image={{ src: cover, alt: `Cover of ${title}` }}
                        sizes="131px"
                        className="absolute! top-px left-[13.333cqw] h-[30cqw] w-[72.778cqw] rounded-b-[50%_100%]"
                    />
                ) : (
                    <div
                        aria-hidden="true"
                        className="bg-faint border-line absolute top-px left-[13.333cqw] h-[30cqw] w-[72.778cqw] rounded-b-[50%_100%] border border-dashed"
                    />
                )}
                <BoardCardTitle
                    board={summary}
                    className="font-display absolute top-[36.111cqw] left-0 w-full text-center text-[17.778cqw] leading-[.9] font-bold"
                />
                <p className="text-muted-foreground absolute top-[72cqw] w-full text-center text-[6cqw]">
                    Draft · only you
                </p>
                <p className="text-muted-foreground absolute top-[94cqw] w-full text-center text-[6cqw]">
                    Last saved
                    <br />
                    <time dateTime={item.updatedAt}>{savedDate(item.updatedAt)}</time>
                </p>
                <p className="text-muted-foreground absolute top-[164cqw] w-full text-center text-[7cqw] underline underline-offset-4">
                    Edit draft
                </p>
                <BoardCardGraphic
                    asset="v2-tokyo-line32.svg"
                    className="bg-card-line absolute top-px left-0 h-px w-full"
                />
                <BoardCardGraphic
                    asset="v2-tokyo-line33.svg"
                    className="bg-card-line absolute top-[82.5cqw] left-[22.222cqw] h-px w-[55.556cqw]"
                />
                <BoardCardGraphic
                    asset="v2-tokyo-line34.svg"
                    className="bg-card-line absolute top-[145.778cqw] left-[36.111cqw] h-px w-[27.778cqw]"
                />
            </div>
            <span className="sr-only">{title}</span>
        </Link>
    );
}

export default function DraftBoardList() {
    const [store] = useState(createDraftBoardsStore);
    const [query, setQuery] = useState("");
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    useEffect(() => {
        void store.load();
        return store.cancel;
    }, [store]);
    return (
        <DraftBoardListContent
            state={state}
            query={query}
            onQueryChange={setQuery}
            onRetry={store.load}
            onLoadMore={store.loadMore}
            onRetryFeatured={store.retryFeatured}
        />
    );
}

export function DraftBoardListContent({
    state,
    query,
    onQueryChange,
    onRetry,
    onLoadMore,
    onRetryFeatured
}: {
    state: DraftBoardsState;
    query: string;
    onQueryChange: (query: string) => void;
    onRetry: () => void;
    onLoadMore: () => void;
    onRetryFeatured: () => void;
}) {
    const reducedMotion = useReducedMotion();
    const matches = filterDraftBoards(state.items, query);
    const recent = state.items.filter((item) => state.featuredIds.includes(item.boardId));
    return (
        <article className="font-body text-foreground min-w-0 pb-28">
            <header className="px-5 pt-16 text-center sm:px-10 md:pt-24">
                <Link href="/create" className={`text-muted-foreground text-12 ${actionClass}`}>
                    Back to Create
                </Link>
                <h1 className="font-display mt-5 text-[clamp(44px,7vw,96px)] leading-[1.02] font-bold tracking-[-0.045em]">
                    MY DRAFTS
                </h1>
                <p className="text-muted-foreground text-14 mx-auto mt-5 max-w-[550px] leading-relaxed">
                    Pick up where you left off. Tweak the details, switch things around,
                    <br className="hidden md:block" /> or give your next adventure a fresh direction.
                </p>
                <div className="border-line focus-within:border-foreground mx-auto mt-12 flex max-w-[550px] items-center rounded-full border px-5 sm:mt-16">
                    <label htmlFor="draft-search" className="sr-only">
                        Search loaded drafts by title
                    </label>
                    <input
                        id="draft-search"
                        type="search"
                        value={query}
                        onChange={(event) => onQueryChange(event.target.value)}
                        placeholder="search for a draft..."
                        className="placeholder:text-muted-foreground text-16 sm:text-20 min-h-16 w-full min-w-0 bg-transparent px-2 text-center focus-visible:outline-2 focus-visible:outline-offset-4 sm:min-h-20"
                    />
                </div>
                <p className="text-muted-foreground text-11 mt-4">Search loaded titles in the library below.</p>
            </header>
            <div className="mx-auto mt-8 max-w-2xl px-5 text-center text-sm">
                {state.loading && <p role="status">Loading drafts…</p>}
                {state.error && (
                    <div role="alert" className="border-line border-y py-5">
                        <p>{state.error}</p>
                        <div className="mt-2 flex flex-wrap justify-center gap-x-6">
                            <button
                                type="button"
                                disabled={state.loading || state.loadingMore}
                                className={actionClass}
                                onClick={state.items.length ? onLoadMore : onRetry}
                            >
                                {state.items.length ? "Retry loading more drafts" : "Try again"}
                            </button>
                            <Link href="/login" className={actionClass}>
                                Sign in
                            </Link>
                        </div>
                    </div>
                )}
                {!state.loading && !state.error && state.items.length === 0 && (
                    <div className="py-16">
                        <h2 className="font-display text-36 font-bold">A little room for possibility.</h2>
                        <p className="text-muted-foreground mt-4">
                            No drafts yet. Save a Board as a draft and it will be waiting here.
                        </p>
                        <Link href="/boards/new" className={`mt-5 ${actionClass}`}>
                            Create a Board
                        </Link>
                    </div>
                )}
            </div>
            {recent.length > 0 && (
                <section
                    aria-labelledby="recent-drafts-heading"
                    className="mx-auto mt-16 max-w-[1520px] pl-5 sm:mt-24 sm:pl-12 lg:pl-20"
                >
                    <Carousel
                        opts={{ align: "start", containScroll: "trimSnaps", duration: reducedMotion ? 0 : 25 }}
                        aria-label="Recent drafts"
                        tabIndex={0}
                        className="focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                        <div className="mb-12 flex flex-wrap items-end justify-between gap-5 pr-5 sm:pr-12">
                            <h2
                                id="recent-drafts-heading"
                                className="font-display text-muted-foreground text-36 sm:text-48 leading-[.9] font-bold"
                            >
                                RECENT
                                <br />
                                DRAFTS
                            </h2>
                            <div className="flex gap-2">
                                <CarouselPrevious aria-label="Previous recent draft" />
                                <CarouselNext aria-label="Next recent draft" />
                            </div>
                        </div>
                        <CarouselContent className="cursor-grab active:cursor-grabbing">
                            {recent.map((item, index) => (
                                <CarouselItem
                                    key={item.boardId}
                                    aria-label={`${index + 1} of ${recent.length}: ${item.title || "Untitled Board"}`}
                                    className="border-line mr-6 basis-full border-r pr-6 sm:mr-12 sm:basis-[700px] sm:pr-12"
                                >
                                    <div className="grid min-w-0 items-center gap-3 sm:grid-cols-[minmax(0,440px)_minmax(0,1fr)] sm:gap-6">
                                        <div className="w-full max-w-[440px]">
                                            {state.documents[item.boardId] ? (
                                                <DraftCollage document={state.documents[item.boardId]} />
                                            ) : (
                                                <div className="border-line bg-faint/30 flex aspect-[440/560] flex-col items-center justify-center gap-4 border px-6 text-center">
                                                    <p className="font-display text-32 max-w-full break-words">
                                                        {item.title || "Untitled Board"}
                                                    </p>
                                                    <p className="text-muted-foreground text-13">
                                                        {state.failedIds.includes(item.boardId)
                                                            ? "Preview unavailable. Your saved draft can still be opened."
                                                            : "Loading draft preview…"}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="border-line mb-8 flex min-w-0 flex-col items-start border-l pl-5 sm:mb-0">
                                            <p className="text-muted-foreground text-11">
                                                Only you can access this draft.
                                            </p>
                                            <p className="text-13 mt-5">Last saved</p>
                                            <time className="text-muted-foreground text-12" dateTime={item.updatedAt}>
                                                {savedDate(item.updatedAt)}
                                            </time>
                                            {state.documents[item.boardId] && (
                                                <>
                                                    <p className="text-13 mt-5">Created</p>
                                                    <time
                                                        className="text-muted-foreground text-12"
                                                        dateTime={state.documents[item.boardId].createdAt}
                                                    >
                                                        {savedDate(state.documents[item.boardId].createdAt)}
                                                    </time>
                                                </>
                                            )}
                                            <Link
                                                href={`/boards/drafts/${item.boardId}`}
                                                aria-label={`Edit recent draft: ${item.title || "Untitled Board"}`}
                                                className={`text-14 mt-8 ${actionClass}`}
                                            >
                                                Edit draft{" "}
                                                <span aria-hidden="true" className="ml-3">
                                                    ↗
                                                </span>
                                            </Link>
                                        </div>
                                    </div>
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                        <p className="text-muted-foreground text-11 mt-4 pr-5" role="status">
                            {state.loadingFeatured
                                ? "Loading recent previews…"
                                : `${recent.length} recent ${recent.length === 1 ? "draft" : "drafts"} · swipe or use the arrow keys to explore.`}
                        </p>
                        {state.failedIds.length > 0 && (
                            <div className="text-13 mt-3 pr-5">
                                <p>Some previews could not be loaded. Your draft links remain available.</p>
                                <button
                                    type="button"
                                    disabled={state.loadingFeatured}
                                    onClick={onRetryFeatured}
                                    className={actionClass}
                                >
                                    {state.loadingFeatured ? "Retrying previews…" : "Retry previews"}
                                </button>
                            </div>
                        )}
                    </Carousel>
                </section>
            )}
            {state.items.length > 0 && (
                <section
                    aria-labelledby="all-drafts-heading"
                    className="mx-auto mt-24 max-w-[1400px] px-5 sm:mt-32 sm:px-12 lg:px-20"
                >
                    <h2
                        id="all-drafts-heading"
                        className="font-display text-muted-foreground text-36 sm:text-48 text-center font-bold"
                    >
                        ALL DRAFTS
                    </h2>
                    <p role="status" className="text-muted-foreground text-12 mt-4 text-center">
                        {query.trim() ? `${matches.length} matching` : state.items.length}{" "}
                        {matches.length === 1 ? "draft" : "drafts"} loaded{state.hasMore ? " · more available" : ""}
                    </p>
                    {matches.length ? (
                        <ul className="border-line mt-12 grid grid-cols-1 border-t sm:grid-cols-2 xl:grid-cols-4">
                            {matches.map((item) => (
                                <li key={item.boardId} className="border-line border-r border-b px-5 py-12 sm:px-10">
                                    <DraftTile item={item} />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-muted-foreground py-16 text-center">
                            <p className="break-words">No loaded drafts match “{query}”.</p>
                            <button type="button" onClick={() => onQueryChange("")} className={actionClass}>
                                Clear search
                            </button>
                        </div>
                    )}
                    {state.hasMore && (
                        <div className="mt-10 text-center">
                            <button
                                type="button"
                                onClick={onLoadMore}
                                disabled={state.loadingMore || state.loading}
                                className={`px-5 ${actionClass}`}
                            >
                                {state.loadingMore ? "Loading more drafts…" : "Load more drafts"}
                            </button>
                            <p className="text-muted-foreground text-11 mt-2">
                                Load more to search the rest of your drafts.
                            </p>
                        </div>
                    )}
                    <div className="mt-16 text-center">
                        <Link href="/boards/new" className={actionClass}>
                            Start a new Board
                        </Link>
                    </div>
                </section>
            )}
        </article>
    );
}
