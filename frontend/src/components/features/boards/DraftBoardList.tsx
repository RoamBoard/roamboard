"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listBoardDrafts, type DraftSummary } from "@/lib/board-creator-api";

export default function DraftBoardList() {
    const [items, setItems] = useState<DraftSummary[] | null>(null);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        void listBoardDrafts()
            .then((result) => {
                setItems(result.items);
                setHasMore(result.hasMore);
            })
            .catch((caught: unknown) =>
                setError(caught instanceof Error ? caught.message : "Drafts could not be loaded.")
            );
    }, []);

    async function loadMore() {
        setLoadingMore(true);
        setError("");
        try {
            const nextPage = page + 1;
            const result = await listBoardDrafts(nextPage);
            setItems((current) => [...(current ?? []), ...result.items]);
            setPage(nextPage);
            setHasMore(result.hasMore);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "More drafts could not be loaded.");
        } finally {
            setLoadingMore(false);
        }
    }

    return (
        <article className="text-foreground mx-auto min-h-[70dvh] max-w-5xl px-5 py-16 sm:px-10">
            <h1 className="font-display text-48 font-bold">YOUR DRAFTS</h1>
            <p className="text-14 text-graphite mt-4">Continue a Board you saved earlier.</p>
            {error ? (
                <p className="text-14 mt-8" role="alert">
                    {error}
                </p>
            ) : null}
            {!error && items === null ? (
                <p className="text-14 mt-8" role="status">
                    Loading drafts...
                </p>
            ) : null}
            {items?.length === 0 ? (
                <p className="text-14 mt-8">
                    No drafts yet.{" "}
                    <Link href="/boards/new" className="underline">
                        Create a Board
                    </Link>
                </p>
            ) : null}
            {items && items.length > 0 ? (
                <ul className="mt-9 grid gap-3">
                    {items.map((item) => (
                        <li key={item.boardId}>
                            <Link
                                href={`/boards/drafts/${item.boardId}`}
                                className="border-line hover:border-foreground block border px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                            >
                                <strong className="font-display text-20 block">{item.title || "Untitled Board"}</strong>
                                <span className="text-11 text-graphite mt-1 block">
                                    Last saved {new Date(item.updatedAt).toLocaleString()}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : null}
            {hasMore ? (
                <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void loadMore()}
                    className="border-foreground text-14 mt-6 border px-5 py-3 disabled:opacity-40"
                >
                    {loadingMore ? "Loading..." : "Load more drafts"}
                </button>
            ) : null}
        </article>
    );
}
