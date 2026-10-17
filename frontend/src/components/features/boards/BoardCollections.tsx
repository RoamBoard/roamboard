"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { mockBoardCollections } from "@/data/my-board-collections";
import { filterLibraryBoards } from "@/lib/my-boards";
import { apiOrigin, loadSavedBoardsPage, ProfileApiError, type SavedBoardSummary } from "@/lib/profile";
import BoardLibrary from "./BoardLibrary";

export default function BoardCollections({ query }: { query: string }) {
    const [saved, setSaved] = useState<SavedBoardSummary[]>([]);
    const [page, setPage] = useState(1);
    const [attempt, setAttempt] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [signIn, setSignIn] = useState(false);
    const archived = filterLibraryBoards(mockBoardCollections.archived, query);

    useEffect(() => {
        const request = { active: true };
        void loadSavedBoardsPage(page)
            .then((result) => {
                if (!request.active) return;
                setSaved((current) => (page === 1 ? result.data : [...current, ...result.data]));
                setHasMore(result.meta?.hasMore ?? false);
                setError("");
            })
            .catch((caught: unknown) => {
                if (!request.active) return;
                setSignIn(caught instanceof ProfileApiError && caught.status === 401);
                if (caught instanceof ProfileApiError && caught.status === 401) {
                    setSaved([]);
                    setHasMore(false);
                }
                setError(caught instanceof Error ? caught.message : "Saved Boards could not be loaded.");
            })
            .finally(() => {
                if (request.active) setLoading(false);
            });
        return () => {
            request.active = false;
        };
    }, [page, attempt]);

    const visible = saved.filter((board) =>
        `${board.title} ${board.owner.displayName}`.toLowerCase().includes(query.trim().toLowerCase())
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
                {error && (
                    <p role="alert" className="text-14 mt-8 text-center">
                        {error}{" "}
                        {signIn ? (
                            <Link href="/login" className="underline">
                                Sign in
                            </Link>
                        ) : (
                            <button
                                type="button"
                                className="underline"
                                onClick={() => {
                                    setLoading(true);
                                    setError("");
                                    setAttempt((value) => value + 1);
                                }}
                            >
                                Retry
                            </button>
                        )}
                    </p>
                )}
                {loading && (
                    <p role="status" className="text-14 py-10 text-center">
                        Loading saved Boards…
                    </p>
                )}
                {!loading && visible.length === 0 && !error && (
                    <p role="status" className="text-14 text-foreground/65 py-20 text-center">
                        {saved.length ? "No saved Boards match your search." : "No saved Boards yet."}
                    </p>
                )}
                <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {visible.map((board) => (
                        <Link
                            key={board.boardId}
                            href={`/boards/${board.boardId}`}
                            className="border-line bg-background block overflow-hidden border"
                        >
                            <div className="bg-faint relative aspect-[4/3]">
                                {board.coverImageUrl ? (
                                    <Image
                                        src={new URL(board.coverImageUrl, apiOrigin).toString()}
                                        alt=""
                                        fill
                                        unoptimized
                                        sizes="33vw"
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
                                        No cover photo
                                    </div>
                                )}
                            </div>
                            <div className="p-4">
                                <h3 className="font-display text-lg font-bold">{board.title}</h3>
                                <p className="text-muted-foreground text-xs">by {board.owner.displayName}</p>
                            </div>
                        </Link>
                    ))}
                </div>
                {hasMore && !error && (
                    <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                            setLoading(true);
                            setPage((value) => value + 1);
                        }}
                        className="border-line mx-auto mt-8 block border px-5 py-2"
                    >
                        Load more
                    </button>
                )}
            </section>
            <section aria-labelledby="archive-saves-heading" className="mx-auto mt-28 max-w-[1320px] md:mt-44">
                <h2
                    id="archive-saves-heading"
                    className="font-display text-foreground/60 text-30 md:text-36 mx-auto grid max-w-md grid-cols-2 font-medium"
                >
                    <span className="border-line border-r py-6 pr-5 text-right">ARCHIVE</span>
                    <span className="pt-20 pl-5">SAVES</span>
                </h2>
                <BoardLibrary
                    id="archive-library"
                    title="ARCHIVED BOARDS"
                    description="Sample archive · past journeys kept apart from active Boards."
                    boards={archived}
                    archived
                />
            </section>
        </>
    );
}
