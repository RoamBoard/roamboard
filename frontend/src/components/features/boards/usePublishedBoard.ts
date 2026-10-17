"use client";

import { useEffect, useState } from "react";
import { loadPublishedBoard } from "@/lib/published-board-data";
import type { PublishedBoardState } from "@/types/published-board";

export default function usePublishedBoard(boardId: string) {
    const [state, setState] = useState<PublishedBoardState>({ status: "loading", data: null });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        // Ignore responses that arrive after leaving this Board or starting another attempt.
        const request = { active: true };
        void loadPublishedBoard(boardId).then((result) => {
            if (request.active) setState(result);
        });
        return () => {
            request.active = false;
        };
    }, [boardId, attempt]);

    function retry() {
        setState({ status: "loading", data: null });
        // A new attempt runs the loading effect again, even though the Board ID is unchanged.
        setAttempt((current) => current + 1);
    }

    return { state, retry };
}
