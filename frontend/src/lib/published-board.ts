import { cache } from "react";
import { mockBoards } from "@/data/mock-boards";
import { mockPublishedBoard } from "@/data/mock-published-board";
import type { PublishedBoardData } from "@/types/published-board";

// Replace this mock lookup with the agreed backend request later.
// Public viewing does not depend on a login or an account-status request.
// cache shares the lookup between the page and its metadata during rendering.
export const getPublishedBoard = cache(
    async (id: string): Promise<PublishedBoardData | null> => {
        // The Tokyo sample has its own author details and photos.
        if (id === mockPublishedBoard.board.id) return mockPublishedBoard;

        // Other mock boards can be viewed here only when they are public.
        const board = mockBoards.find(
            (entry) => entry.id === id && entry.visibility === "public"
        );
        if (!board) return null;

        // These boards use a placeholder author until real author data is available.
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
