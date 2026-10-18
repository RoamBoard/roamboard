"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { listPublishedBoards, type PublishedSummary } from "@/lib/board-creator-api";

import PhotoBoardCard from "./cards/PhotoBoardCard";
import { toSummaryPhotoBoardCard } from "@/lib/photo-board-card";

export function OwnedBoardCard({ board }: { board: PublishedSummary }) {
    return (
        <>
            <PhotoBoardCard
                board={toSummaryPhotoBoardCard(board)}
                href={`/boards/${board.boardId}`}
                details
                ownership="owner"
            />
            <div className="mt-3 flex flex-wrap justify-between gap-4 text-xs">
                <Link
                    href={`/boards/${board.boardId}`}
                    className="inline-flex min-h-11 items-center underline underline-offset-4"
                >
                    View Board →
                </Link>
                <Link
                    href={`/boards/${board.boardId}/edit`}
                    className="inline-flex min-h-11 items-center underline underline-offset-4"
                >
                    Edit Board →
                </Link>
            </div>
        </>
    );
}

export default function PublishedBoardList() {
    const [boards, setBoards] = useState<PublishedSummary[] | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);
    const pendingMore = useRef(false);

    useEffect(() => {
        const request = { active: true };
        void listPublishedBoards()
            .then((result) => {
                if (!request.active) return;
                setBoards(result.items);
                setHasMore(result.hasMore);
            })
            .catch((caught: unknown) => {
                if (request.active) setError(caught instanceof Error ? caught.message : "Boards could not be loaded.");
            });
        return () => {
            request.active = false;
        };
    }, [attempt]);

    async function loadMore() {
        if (pendingMore.current) return;
        pendingMore.current = true;
        setLoadingMore(true);
        setError("");
        try {
            const nextPage = page + 1;
            const result = await listPublishedBoards(nextPage);
            setBoards((current) => [
                ...new Map([...(current ?? []), ...result.items].map((board) => [board.boardId, board])).values()
            ]);
            setPage(nextPage);
            setHasMore(result.hasMore);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "More Boards could not be loaded.");
        } finally {
            pendingMore.current = false;
            setLoadingMore(false);
        }
    }

    return (
        <article className="text-foreground mx-auto min-h-[70dvh] w-full max-w-6xl px-5 py-16 sm:px-10">
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
                    ) : (
                        <button
                            type="button"
                            className="ml-2 min-h-11 underline"
                            disabled={loadingMore}
                            onClick={() => {
                                if (boards === null) {
                                    setError("");
                                    setAttempt((value) => value + 1);
                                } else void loadMore();
                            }}
                        >
                            Retry
                        </button>
                    )}
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
                <ul className="mt-9 grid items-start gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
                    {boards.map((board) => (
                        <li key={board.boardId}>
                            <OwnedBoardCard board={board} />
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
