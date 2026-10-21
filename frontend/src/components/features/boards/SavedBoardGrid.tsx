"use client";

import { useRef } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { toSavedPhotoBoardCard } from "@/lib/photo-board-card";
import type { SavedBoardSummary } from "@/lib/profile";
import { BoardLibraryCarousel, boardLibrarySlideClass } from "./BoardLibrary";
import AccountPhotoBoardCard from "./cards/AccountPhotoBoardCard";

export default function SavedBoardGrid({
    boards,
    onUnsave,
    presentation = "grid"
}: {
    boards: SavedBoardSummary[];
    presentation?: "grid" | "library";
    onUnsave: (boardId: number) => void;
}) {
    const reduced = useReducedMotion();
    const visibleBoards = presentation === "library" ? boards.slice(0, 10) : boards;
    const items = (
        <AnimatePresence initial={false}>
            {visibleBoards.map((board, index) => (
                <SavedBoardItem
                    key={board.boardId}
                    board={board}
                    reduced={Boolean(reduced)}
                    onUnsave={onUnsave}
                    library={presentation === "library"}
                    index={index}
                    count={visibleBoards.length}
                />
            ))}
        </AnimatePresence>
    );
    return presentation === "library" ? (
        <BoardLibraryCarousel
            id="profile-saved-library"
            title="Currently Inspired By"
            count={boards.length}
            variant="profile"
            viewAllHref="/boards/collections/saved"
            listLabel="Saved Boards"
            emptyMessage=""
        >
            {items}
        </BoardLibraryCarousel>
    ) : (
        <ul
            tabIndex={-1}
            aria-label="Saved Boards"
            className="mt-8 grid items-start gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
        >
            {items}
        </ul>
    );
}

function SavedBoardItem({
    board,
    reduced,
    onUnsave,
    library,
    index,
    count
}: {
    board: SavedBoardSummary;
    library: boolean;
    index: number;
    count: number;
    reduced: boolean;
    onUnsave: (boardId: number) => void;
}) {
    const present = useIsPresent();
    const row = useRef<HTMLLIElement>(null);
    const hadFocus = useRef(false);
    return (
        <motion.li
            ref={row}
            className={library ? boardLibrarySlideClass("profile") : undefined}
            aria-roledescription={library ? "slide" : undefined}
            aria-label={library ? `${index + 1} of ${count}: ${board.title}` : undefined}
            onFocusCapture={() => {
                hadFocus.current = true;
            }}
            onBlurCapture={(event) => {
                if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) hadFocus.current = false;
            }}
            // An exiting row must not navigate or re-save while its confirmed removal animates.
            inert={!present}
            layout={reduced ? false : "position"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.97 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
        >
            <AccountPhotoBoardCard
                board={toSavedPhotoBoardCard(board)}
                ownership="other"
                initialSaved
                href={`/boards/${board.boardId}`}
                onSavedChange={(saved) => {
                    if (!saved) {
                        // Move keyboard focus before inert/removal makes the current bookmark unavailable.
                        const current = row.current;
                        if (
                            current &&
                            (current.contains(document.activeElement) ||
                                (hadFocus.current && document.activeElement === document.body))
                        ) {
                            const siblings = Array.from(current.parentElement?.children ?? []);
                            const index = siblings.indexOf(current);
                            const candidates = [...siblings.slice(index + 1), ...siblings.slice(0, index).reverse()];
                            const next = candidates
                                .filter((item) => !item.hasAttribute("inert"))
                                .map((item) => item.querySelector<HTMLElement>("button:not(:disabled), a[href]"))
                                .find(Boolean);
                            (next ?? current.parentElement)?.focus();
                        }
                        onUnsave(board.boardId);
                    }
                }}
            />
        </motion.li>
    );
}
