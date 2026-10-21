"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { appendRoamFlowBoards, type RoamFlowPage, type RoamFlowSource } from "@/lib/roamflow";

export function useRoamFlow(initialPage: RoamFlowPage, source: RoamFlowSource) {
    const [feed, setFeed] = useState({
        boards: appendRoamFlowBoards([], initialPage.boards),
        nextCursor: initialPage.nextCursor,
        status: "idle" as "idle" | "loading" | "error"
    });
    const request = useRef<AbortController | null>(null);

    useEffect(() => () => request.current?.abort(), []);
    useEffect(() => {
        if (feed.status !== "loading") request.current = null;
    }, [feed.status]);

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
            startTransition(() => {
                setFeed((current) =>
                    controller.signal.aborted
                        ? current
                        : {
                              boards: appendRoamFlowBoards(current.boards, page.boards),
                              nextCursor: page.nextCursor,
                              status: "idle"
                          }
                );
            });
        } catch {
            if (!controller.signal.aborted) setFeed((current) => ({ ...current, status: "error" }));
        }
    }, [feed.nextCursor, source]);

    return { ...feed, loadMore };
}
