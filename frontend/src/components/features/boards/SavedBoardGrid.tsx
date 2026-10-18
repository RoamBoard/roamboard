"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toSavedPhotoBoardCard } from "@/lib/photo-board-card";
import type { SavedBoardSummary } from "@/lib/profile";
import AccountPhotoBoardCard from "./cards/AccountPhotoBoardCard";

export default function SavedBoardGrid({
    boards,
    onUnsave
}: {
    boards: SavedBoardSummary[];
    onUnsave: (boardId: number) => void;
}) {
    const reduced = useReducedMotion();
    return (
        <ul className="mt-8 grid items-start gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence initial={false}>
                {boards.map((board) => (
                    <motion.li
                        key={board.boardId}
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
                                if (!saved) onUnsave(board.boardId);
                            }}
                        />
                    </motion.li>
                ))}
            </AnimatePresence>
        </ul>
    );
}
