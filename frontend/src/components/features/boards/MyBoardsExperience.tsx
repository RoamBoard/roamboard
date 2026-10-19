"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Search, X } from "lucide-react";
import { filterGalleryBoards } from "@/lib/my-boards";
import { createMyBoardsStore, type MyBoardsState, type MyBoardsStore } from "@/lib/my-boards-store";
import SpatialGallery from "./SpatialGallery";
import BoardCollections from "./BoardCollections";
import BoardLibrary from "./BoardLibrary";

export default function MyBoardsExperience() {
    const [store] = useState(createMyBoardsStore);
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    useEffect(() => {
        void store.load();
        return store.cancel;
    }, [store]);
    return <MyBoardsContent state={state} actions={store} />;
}

export function MyBoardsContent({ state, actions }: { state: MyBoardsState; actions: MyBoardsStore }) {
    const { collection, query, loading, error, preview, hasMore, loadingMore, failed, retryingFailed, publicSearch } =
        state;
    const matches = filterGalleryBoards(collection, query);
    const publicBoards = publicSearch.boards.filter(
        (board) => !collection.some((owned) => owned.collage.id === board.id)
    );
    const searchTerm = query.trim();
    return (
        <article className="font-body min-w-0 pb-24">
            <header className="px-5 pt-16 text-center md:pt-24">
                <h1 className="font-display text-[clamp(40px,6.4vw,96px)] leading-[1.02] font-bold tracking-[-0.045em]">
                    MY BOARDS
                </h1>
                <p className="text-foreground/65 text-12 md:text-14 mx-auto mt-5 max-w-[560px] leading-snug">
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
                        Search your Boards and public Boards
                    </label>
                    <input
                        id="board-search"
                        type="search"
                        value={query}
                        onChange={(event) => actions.setQuery(event.target.value)}
                        placeholder="search your Boards and public Boards..."
                        className="text-14 placeholder:text-muted-foreground md:text-20 w-full min-w-0 bg-transparent px-4 py-5 text-center outline-none [&::-webkit-search-cancel-button]:appearance-none"
                    />
                    <button
                        aria-label="Clear Board search"
                        disabled={!query}
                        onClick={() => actions.setQuery("")}
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
                        <button onClick={actions.load} className="cursor-pointer underline underline-offset-4">
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
            {searchTerm && (
                <section aria-labelledby="public-boards-heading" className="mx-auto mt-24 max-w-[1320px] px-5">
                    <h2
                        id="public-boards-heading"
                        className="font-display text-foreground/60 text-30 md:text-36 text-center font-medium"
                    >
                        PUBLIC BOARDS
                    </h2>
                    <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-center text-sm">
                        Published Boards from the community. Boards in your loaded collection below are omitted here.
                    </p>
                    {searchTerm.length < 2 ? (
                        <p className="text-muted-foreground mt-8 text-center text-sm">
                            Enter at least two characters to search public Boards.
                        </p>
                    ) : (
                        <>
                            {publicSearch.loading && (
                                <p role="status" className="mt-8 text-center text-sm">
                                    Searching public Boards…
                                </p>
                            )}
                            {publicSearch.error && (
                                <div role="alert" className="mt-8 text-center text-sm">
                                    {publicSearch.error}{" "}
                                    <button
                                        type="button"
                                        onClick={() => void actions.retryPublicSearch()}
                                        className="underline"
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}
                            {!publicSearch.loading && !publicSearch.error && publicSearch.boards.length === 0 && (
                                <p role="status" className="mt-8 text-center text-sm">
                                    No public Boards match your search.
                                </p>
                            )}
                            {!publicSearch.loading &&
                                !publicSearch.error &&
                                publicSearch.boards.length > 0 &&
                                publicBoards.length === 0 && (
                                    <p role="status" className="mt-8 text-center text-sm">
                                        Matching Boards from your collection are shown below.
                                    </p>
                                )}
                            {publicBoards.length > 0 && (
                                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {publicBoards.map((board) => (
                                        <Link
                                            key={board.id}
                                            href={`/boards/${board.id}`}
                                            className="border-line hover:bg-faint focus-visible:outline-foreground block border p-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4"
                                        >
                                            <h3 className="font-display text-xl font-bold">{board.title}</h3>
                                            {[board.city, board.country].filter(Boolean).length > 0 && (
                                                <p className="text-muted-foreground mt-2 text-xs">
                                                    {[board.city, board.country].filter(Boolean).join(" · ")}
                                                </p>
                                            )}
                                            {board.description && (
                                                <p className="text-muted-foreground mt-4 line-clamp-3 text-sm">
                                                    {board.description}
                                                </p>
                                            )}
                                            <span className="mt-5 inline-block text-xs underline underline-offset-4">
                                                Open Board ↗
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                            {!publicSearch.loading &&
                                !publicSearch.error &&
                                publicSearch.page * 10 < publicSearch.total && (
                                    <button
                                        type="button"
                                        onClick={() => void actions.loadMorePublic()}
                                        className="border-line mx-auto mt-8 block min-h-11 cursor-pointer border px-5 py-2 text-sm"
                                    >
                                        Load more public Boards
                                    </button>
                                )}
                        </>
                    )}
                </section>
            )}
            {!loading && failed.length > 0 && (
                <div role="status" className="text-12 text-foreground/65 mx-auto mt-6 max-w-xl px-5 text-center">
                    <p>
                        {failed.length} {failed.length === 1 ? "Board couldn’t" : "Boards couldn’t"} be loaded.
                    </p>
                    <button
                        type="button"
                        onClick={actions.retryFailed}
                        disabled={retryingFailed || loadingMore}
                        className="mt-2 cursor-pointer py-2 underline underline-offset-4 disabled:opacity-50"
                    >
                        {retryingFailed ? "Retrying unavailable Boards…" : "Retry unavailable Boards"}
                    </button>
                </div>
            )}
            {!loading && matches.length > 0 && (
                <>
                    <SpatialGallery boards={matches.slice(0, 5)} />
                    <BoardLibrary
                        title="RECENTLY CREATED"
                        id="created-library"
                        description={
                            preview
                                ? "Sample created Boards · visual fixtures, not your account."
                                : "Your published Boards"
                        }
                        boards={matches}
                        hasMore={!preview && hasMore}
                        loadingMore={loadingMore}
                        onLoadMore={actions.loadMore}
                    />
                </>
            )}
            {!loading && matches.length === 0 && (
                <section className="mx-auto max-w-lg px-5 py-28 text-center">
                    <h2 className="font-display text-30 font-medium">
                        {query.trim()
                            ? "No matching Boards in your collection."
                            : failed.length
                              ? "Your Boards couldn’t be displayed."
                              : "Your next journey starts here."}
                    </h2>
                    <p className="text-14 text-muted-foreground mt-4">
                        {query.trim()
                            ? "Try a Board title, destination or country."
                            : failed.length
                              ? "Retry the unavailable Boards above. Your collection has not been replaced with samples."
                              : "Create a Board and make room for a new memory."}
                    </p>
                    {query.trim() ? (
                        <button
                            onClick={() => actions.setQuery("")}
                            className="text-14 mt-6 cursor-pointer py-3 underline underline-offset-4"
                        >
                            clear search ↗
                        </button>
                    ) : failed.length ? null : (
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
                        onClick={actions.loadMore}
                        className="text-12 cursor-pointer px-5 py-3 underline underline-offset-4 disabled:opacity-50"
                    >
                        {loadingMore ? "Loading…" : "load more Boards ↓"}
                    </button>
                    <p className="text-10 text-muted-foreground mt-2">Search covers the Boards loaded so far.</p>
                </div>
            )}
            {!loading && <BoardCollections query={query} />}
        </article>
    );
}
