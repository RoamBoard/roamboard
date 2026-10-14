/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listPublishedBoards, type PublishedSummary } from "@/lib/board-creator-api";

export default function PublishedBoardList() {
    const [boards, setBoards] = useState<PublishedSummary[] | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        void listPublishedBoards()
            .then((result) => {
                setBoards(result.items);
                setHasMore(result.hasMore);
            })
            .catch((caught: unknown) =>
                setError(caught instanceof Error ? caught.message : "Boards could not be loaded.")
            );
    }, []);

    async function loadMore() {
        setLoadingMore(true);
        setError("");
        try {
            const nextPage = page + 1;
            const result = await listPublishedBoards(nextPage);
            setBoards((current) => [...(current ?? []), ...result.items]);
            setPage(nextPage);
            setHasMore(result.hasMore);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "More Boards could not be loaded.");
        } finally {
            setLoadingMore(false);
        }
    }

    return (
        <article className="text-foreground mx-auto min-h-[70dvh] max-w-6xl px-5 py-16 sm:px-10">
            <p className="text-10 tracking-label text-stone font-bold uppercase">Your journeys</p>
            <h1 className="font-display text-48 sm:text-72 mt-3 leading-none font-bold">MY BOARDS</h1>
            <p className="text-14 text-graphite mt-4">Your published Boards, newest first.</p>
            {error ? (
                <p className="text-14 mt-8" role="alert">
                    {error}
                    {error === "Not signed in" ? (
                        <>
                            {" "}
                            <Link href="/login" className="underline">
                                Sign in
                            </Link>
                        </>
                    ) : null}
                </p>
            ) : null}
            {!error && boards === null ? (
                <p className="text-14 mt-8" role="status">
                    Loading your Boards...
                </p>
            ) : null}
            {boards?.length === 0 ? (
                <p className="text-14 mt-8">
                    No published Boards yet.{" "}
                    <Link href="/boards/new" className="underline">
                        Create a Board
                    </Link>
                </p>
            ) : null}
            {boards && boards.length > 0 ? (
                <ul className="mt-9 grid gap-4 sm:grid-cols-2">
                    {boards.map((board) => (
                        <li key={board.boardId}>
                            <Link
                                href={`/boards/${board.boardId}`}
                                className="border-line hover:border-foreground focus-visible:outline-foreground block h-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                            >
                                {board.coverImageUrl ? (
                                    <img
                                        src={board.coverImageUrl}
                                        alt=""
                                        className="aspect-[16/9] w-full object-cover"
                                    />
                                ) : (
                                    <div className="bg-faint text-graphite text-12 grid aspect-[16/9] place-items-center">
                                        Default cover
                                    </div>
                                )}
                                <div className="p-5">
                                    <strong className="font-display text-24 block font-bold">
                                        {board.title || "Untitled Board"}
                                    </strong>
                                    <span className="text-11 text-graphite mt-2 block uppercase">
                                        {board.visibility}
                                    </span>
                                    <span className="text-12 mt-5 block underline">View Board →</span>
                                </div>
                            </Link>
                            <Link
                                href={`/boards/${board.boardId}/edit`}
                                className="border-foreground text-13 mt-2 inline-block border-b py-2"
                            >
                                Edit Board →
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
                    className="border-foreground text-14 mt-7 border px-5 py-3 disabled:opacity-40"
                >
                    {loadingMore ? "Loading..." : "Load more Boards"}
                </button>
            ) : null}
        </article>
    );
}
