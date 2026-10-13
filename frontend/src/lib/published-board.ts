import { cache } from "react";
import { mockBoards } from "@/data/mock-boards";
import { mockPublishedBoard } from "@/data/mock-published-board";
import type { PublishedBoardData } from "@/types/published-board";

// Replace this mock lookup with the agreed backend request later.
// Public viewing does not depend on a login or an account-status request.
export const getPublishedBoard = cache(
    async (id: string): Promise<PublishedBoardData | null> => {
        if (id === mockPublishedBoard.board.id) return mockPublishedBoard;

        const board = mockBoards.find(
            (entry) => entry.id === id && entry.visibility === "public"
        );
        if (!board) return null;

        return {
            board,
            author: {
                id: board.ownerId,
                name: "Roamboard traveller",
                bio: "A fictional author for this development preview."
            },
            highlights: []
        };
    }
);
