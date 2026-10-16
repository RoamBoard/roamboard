import { BoardApiError, loadBoardDocument } from "./board-creator-api";
import { toPublishedBoardData } from "./published-board-data";
import type { PublishedBoardData } from "../types/published-board";

export type PublishedBoardState = {
    status: "loading" | "ready" | "not-found" | "unauthenticated" | "forbidden" | "error";
    data: PublishedBoardData | null;
};

export function createPublishedBoardStore(boardId: string) {
    const state: { snapshot: PublishedBoardState; pending: boolean } = {
        snapshot: { status: "loading", data: null },
        pending: false
    };
    const listeners = new Set<() => void>();
    function update(status: PublishedBoardState["status"], data: PublishedBoardData | null = null) {
        state.snapshot = { status, data };
        listeners.forEach((listener) => listener());
    }
    return {
        getSnapshot: () => state.snapshot,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        async load() {
            if (state.pending) return;
            const id = Number(boardId);
            if (!/^[1-9]\d*$/.test(boardId) || !Number.isSafeInteger(id) || id > 2147483647) {
                update("not-found");
                return;
            }
            state.pending = true;
            update("loading");
            try {
                const document = await loadBoardDocument(id);
                if (document.status !== "published") update("not-found");
                else update("ready", toPublishedBoardData(document));
            } catch (error) {
                const status = error instanceof BoardApiError ? error.status : undefined;
                update(
                    status === 404
                        ? "not-found"
                        : status === 401
                          ? "unauthenticated"
                          : status === 403
                            ? "forbidden"
                            : "error"
                );
            } finally {
                state.pending = false;
            }
        }
    };
}
