"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { createSavedBoardsStore } from "@/lib/saved-boards-store";
import SavedBoardGrid from "./SavedBoardGrid";

export default function BoardCollections({ query }: { query: string }) {
    const [store] = useState(() => createSavedBoardsStore());
    const saved = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    useEffect(() => {
        void store.loadFirst();
    }, [store]);
    const visible = saved.items.filter((board) =>
        `${board.title} ${board.owner.displayName} ${board.owner.username}`
            .toLowerCase()
            .includes(query.trim().toLowerCase())
    );
    return (
        <>
            <section aria-labelledby="saved-boards-heading" className="mx-auto mt-32 max-w-[1320px] px-5">
                <h2
                    id="saved-boards-heading"
                    className="font-display text-foreground/60 text-30 md:text-36 text-center font-medium"
                >
                    SAVED BOARDS
                </h2>
                {saved.error ? (
                    <p role="alert" className="text-14 mt-8 text-center">
                        {saved.error}{" "}
                        {saved.signInRequired ? (
                            <Link href="/login" className="underline">
                                Sign in
                            </Link>
                        ) : (
                            <button
                                type="button"
                                className="min-h-11 underline"
                                onClick={() => {
                                    void store.retry();
                                }}
                            >
                                Retry
                            </button>
                        )}
                    </p>
                ) : null}
                {(!saved.loaded || saved.loading) && (
                    <p role="status" className="text-14 py-10 text-center">
                        Loading saved Boards…
                    </p>
                )}
                {saved.loaded && !saved.loading && !saved.error && visible.length === 0 && (
                    <p role="status" className="text-14 text-foreground/65 py-20 text-center">
                        {saved.items.length ? "No saved Boards match your search." : "No saved Boards yet."}
                    </p>
                )}
                <SavedBoardGrid boards={visible} onUnsave={store.removeConfirmed} />
                {saved.hasMore && !saved.error && (
                    <button
                        type="button"
                        disabled={saved.loading}
                        onClick={() => {
                            void store.loadMore();
                        }}
                        className="border-line mx-auto mt-8 block min-h-11 border px-5 py-2"
                    >
                        Load more
                    </button>
                )}
            </section>
        </>
    );
}
