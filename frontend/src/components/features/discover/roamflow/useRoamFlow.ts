"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { appendRoamFlowBoards, type RoamFlowPage, type RoamFlowSource } from "@/lib/roamflow";

export function useRoamFlow(initialPage: RoamFlowPage, source: RoamFlowSource) {
    const [feed, setFeed] = useState({
        boards: appendRoamFlowBoards([], initialPage.boards),
        nextCursor: initialPage.nextCursor,
        status: "idle" as "idle" | "loading" | "error"
    });
    const request = useRef<AbortController | null>(null);

    const cancel = useCallback(() => {
        request.current?.abort();
        request.current = null;
        setFeed((current) => (current.status === "loading" ? { ...current, status: "idle" } : current));
    }, []);

    useEffect(() => () => request.current?.abort(), []);

    const loadMore = useCallback(async () => {
        if (request.current || feed.nextCursor === null) return;
        const controller = new AbortController();
        request.current = controller;
        setFeed((current) => ({ ...current, status: "loading" }));
        try {
            const page = await source(feed.nextCursor, controller.signal);
            if (controller.signal.aborted) return;
            // A stalled cursor must not cause an observer/request loop.
            if (page.nextCursor === feed.nextCursor) throw new Error("RoamFlow cursor did not advance");
            setFeed((current) => ({
                boards: appendRoamFlowBoards(current.boards, page.boards),
                nextCursor: page.nextCursor,
                status: "idle"
            }));
        } catch {
            if (!controller.signal.aborted) setFeed((current) => ({ ...current, status: "error" }));
        } finally {
            if (request.current === controller) request.current = null;
        }
    }, [feed.nextCursor, source]);

    return { ...feed, loadMore, cancel };
}
