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
    const { collection, query, loading, error, preview, hasMore, loadingMore, failed, retryingFailed } = state;
    const matches = filterGalleryBoards(collection, query);
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
                        Search your Boards
                    </label>
                    <input
                        id="board-search"
                        type="search"
                        value={query}
                        onChange={(event) => actions.setQuery(event.target.value)}
                        placeholder="search for a board..."
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
                            ? "No created Boards found."
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
