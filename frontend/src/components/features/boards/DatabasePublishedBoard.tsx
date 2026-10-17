"use client";

import Link from "next/link";
import { useEffect } from "react";
import BoardPageMessage from "@/components/features/boards/BoardPageMessage";
import PublishedBoard from "@/components/features/boards/PublishedBoard";
import PublishedBoardShell from "@/components/features/boards/PublishedBoardShell";
import usePublishedBoard from "@/components/features/boards/usePublishedBoard";
import type { PublishedBoardState } from "@/types/published-board";

// Failed or restricted reads show a message instead of substituting a sample Board.
export function DatabasePublishedBoardContent({ state, onRetry }: { state: PublishedBoardState; onRetry: () => void }) {
    if (state.status === "ready" && state.data) {
        return (
            <PublishedBoardShell>
                <PublishedBoard key={state.data.board.id} {...state.data} />
            </PublishedBoardShell>
        );
    }
    if (state.status === "loading") {
        return (
            <BoardPageMessage title="Loading board">
                <p role="status">Loading your board...</p>
            </BoardPageMessage>
        );
    }
    if (state.status === "not-found") {
        return (
            <BoardPageMessage title="Board not found">
                This board could not be found or is not available to you.
            </BoardPageMessage>
        );
    }
    if (state.status === "unauthenticated") {
        return (
            <BoardPageMessage title="Sign in to view this board">
                <Link href="/login" className="underline underline-offset-4">
                    Sign in
                </Link>
            </BoardPageMessage>
        );
    }
    return (
        <BoardPageMessage title={state.status === "forbidden" ? "Board access denied" : "Could not load this board"}>
            <p role="alert">
                {state.status === "forbidden"
                    ? "You don't have permission to view this board."
                    : "Something went wrong while loading the board. Please try again."}
            </p>
            <button
                type="button"
                onClick={onRetry}
                className="border-line hover:bg-faint mt-5 min-h-11 cursor-pointer border px-5 py-2 focus-visible:outline-2 focus-visible:outline-offset-4"
            >
                Try again
            </button>
        </BoardPageMessage>
    );
}

export default function DatabasePublishedBoard({ boardId }: { boardId: string }) {
    const { state, retry } = usePublishedBoard(boardId);
    useEffect(() => {
        if (state.status === "ready" && state.data) document.title = `${state.data.board.title} | Roamboard`;
    }, [state]);
    return <DatabasePublishedBoardContent state={state} onRetry={retry} />;
}
