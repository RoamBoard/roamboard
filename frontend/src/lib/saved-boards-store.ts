import { loadSavedBoardsPage, ProfileApiError, type SavedBoardSummary } from "./profile";

export type SavedBoardsState = {
    items: SavedBoardSummary[];
    loading: boolean;
    hasMore: boolean;
    error: string;
    signInRequired: boolean;
    loaded: boolean;
};

// Page-local collection. Offset pagination restarts after confirmed removals so it cannot skip shifted rows.
export function createSavedBoardsStore(limit = 20) {
    const listeners = new Set<() => void>();
    const control = { page: 0, failedPage: 1, refreshQueued: false };
    const state = {
        current: {
            items: [],
            loading: false,
            hasMore: false,
            error: "",
            signInRequired: false,
            loaded: false
        } as SavedBoardsState
    };
    const update = (next: SavedBoardsState) => {
        state.current = next;
        listeners.forEach((listener) => listener());
    };
    async function load(page: number) {
        if (state.current.loading) return;
        if (page === 1) control.refreshQueued = false;
        control.failedPage = page;
        update({ ...state.current, loading: true, error: "", signInRequired: false });
        try {
            const result = await loadSavedBoardsPage(page, limit);
            if (!control.refreshQueued) {
                const items = [
                    ...new Map(
                        [...(page === 1 ? [] : state.current.items), ...result.data].map((board) => [
                            board.boardId,
                            board
                        ])
                    ).values()
                ];
                control.page = page;
                update({
                    items,
                    loading: true,
                    hasMore: result.meta?.hasMore ?? false,
                    error: "",
                    signInRequired: false,
                    loaded: true
                });
            }
        } catch (caught) {
            const signInRequired = caught instanceof ProfileApiError && caught.status === 401;
            update({
                ...state.current,
                items: signInRequired ? [] : state.current.items,
                hasMore: false,
                error: caught instanceof Error ? caught.message : "Saved Boards could not be loaded.",
                signInRequired,
                loaded: true
            });
        } finally {
            update({ ...state.current, loading: false });
            if (control.refreshQueued) void load(1);
        }
    }
    return {
        getSnapshot: () => state.current,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        loadFirst: () => (control.page === 0 ? load(1) : Promise.resolve()),
        loadMore: () => (state.current.hasMore && !state.current.error ? load(control.page + 1) : Promise.resolve()),
        retry: () => load(control.failedPage),
        removeConfirmed(boardId: number) {
            if (!state.current.items.some((board) => board.boardId === boardId)) return;
            control.refreshQueued = true;
            control.failedPage = 1;
            update({
                ...state.current,
                items: state.current.items.filter((board) => board.boardId !== boardId),
                hasMore: false
            });
            if (!state.current.loading) void load(1);
        }
    };
}
