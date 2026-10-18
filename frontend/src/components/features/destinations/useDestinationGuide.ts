"use client";

import { useEffect, useState } from "react";
import { loadDestinationGuide, type DestinationGuideData, type DestinationGuideInput } from "@/lib/destination-guides";

// The route keys this hook's component by city, keeping requests and cards local to that guide.
export default function useDestinationGuide(input: DestinationGuideInput) {
    const [data, setData] = useState<DestinationGuideData | null>(null);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [attempt, setAttempt] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        void loadDestinationGuide(input, page, controller.signal)
            .then((next) => {
                if (controller.signal.aborted) return;
                setData((previous) => {
                    if (page === 1 || !previous) return next;
                    // Later pages add cards. A Board updated between requests must not appear twice.
                    const newBoards = next.boards.filter(
                        (board) => !previous.boards.some((loaded) => loaded.boardId === board.boardId)
                    );
                    return { ...next, boards: [...previous.boards, ...newBoards] };
                });
            })
            .catch((caught: unknown) => {
                if (!controller.signal.aborted)
                    setError(caught instanceof Error ? caught.message : "This destination could not be loaded.");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [input, page, attempt]);

    function retry() {
        setError("");
        setLoading(true);
        setAttempt((current) => current + 1);
    }

    function loadMore() {
        if (loading || error || data?.unavailable.includes("boards") || !data?.hasMore) return;
        setError("");
        setLoading(true);
        setPage((current) => current + 1);
    }

    return { data, error, loading, retry, loadMore };
}
