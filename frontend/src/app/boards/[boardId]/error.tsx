"use client";

import BoardPageMessage from "@/components/features/boards/BoardPageMessage";

// Next.js shows this if loading or rendering fails. reset retries the page.
export default function BoardError({ reset }: { reset: () => void }) {
    return (
        <BoardPageMessage title="Could not load this board">
            <p role="alert">
                Something went wrong while loading the board. Please try again.
            </p>
            <button
                type="button"
                onClick={reset}
                className="border-line hover:bg-faint mt-5 min-h-11 cursor-pointer border px-5 py-2 focus-visible:outline-2 focus-visible:outline-offset-4"
            >
                Try again
            </button>
        </BoardPageMessage>
    );
}
