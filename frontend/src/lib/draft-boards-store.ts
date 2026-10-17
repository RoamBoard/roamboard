import { listBoardDrafts, loadBoardDocument, type BoardDocument, type DraftSummary } from "./board-creator-api";

export type DraftBoardsState = {
    items: DraftSummary[];
    documents: Record<number, BoardDocument>;
    failedIds: number[];
    featuredIds: number[];
    loading: boolean;
    loadingFeatured: boolean;
    loadingMore: boolean;
    error: string;
    page: number;
    hasMore: boolean;
};

export function filterDraftBoards(items: readonly DraftSummary[], query: string) {
    const normalize = (value: string) =>
        value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    const words = normalize(query).trim().split(/\s+/).filter(Boolean);
    return items.filter((item) => words.every((word) => normalize(item.title || "Untitled Board").includes(word)));
}

// A page-local request boundary, following the existing My Boards collection pattern.
export function createDraftBoardsStore() {
    const state: { snapshot: DraftBoardsState; version: number } = {
        snapshot: {
            items: [],
            documents: {},
            failedIds: [],
            featuredIds: [],
            loading: true,
            loadingFeatured: false,
            loadingMore: false,
            error: "",
            page: 1,
            hasMore: false
        },
        version: 0
    };
    const listeners = new Set<() => void>();
    function update(patch: Partial<DraftBoardsState>) {
        state.snapshot = { ...state.snapshot, ...patch };
        listeners.forEach((listener) => listener());
    }
    async function readFeatured(ids: number[], version: number) {
        update({ loadingFeatured: true });
        const results = await Promise.allSettled(
            ids.map(async (id) => {
                const board = await loadBoardDocument(id);
                if (board.status !== "draft" || !board.permissions.canEditContent)
                    throw new Error("Draft unavailable.");
                return board;
            })
        );
        if (version !== state.version) return;
        update({
            documents: {
                ...state.snapshot.documents,
                ...Object.fromEntries(
                    results.flatMap((result) =>
                        result.status === "fulfilled" ? [[result.value.boardId, result.value]] : []
                    )
                )
            },
            failedIds: ids.filter((_, index) => results[index].status === "rejected"),
            loadingFeatured: false
        });
    }
    return {
        getSnapshot: () => state.snapshot,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        cancel() {
            state.version += 1;
        },
        async load() {
            const version = ++state.version;
            update({ loading: true, loadingMore: false, loadingFeatured: false, error: "" });
            try {
                const result = await listBoardDrafts(1);
                if (version !== state.version) return;
                const items = [...new Map(result.items.map((item) => [item.boardId, item])).values()];
                update({
                    items,
                    featuredIds: items.slice(0, 5).map((item) => item.boardId),
                    page: 1,
                    hasMore: result.hasMore,
                    documents: {},
                    failedIds: [],
                    loading: false
                });
                await readFeatured(
                    items.slice(0, 5).map((item) => item.boardId),
                    version
                );
            } catch (caught) {
                if (version !== state.version) return;
                update({
                    loading: false,
                    error: caught instanceof Error ? caught.message : "Drafts could not be loaded."
                });
            }
        },
        async loadMore() {
            if (state.snapshot.loading || state.snapshot.loadingMore || !state.snapshot.hasMore) return;
            const version = state.version;
            const page = state.snapshot.page + 1;
            update({ loadingMore: true, error: "" });
            try {
                const result = await listBoardDrafts(page);
                if (version !== state.version) return;
                const items = [
                    ...new Map([...state.snapshot.items, ...result.items].map((item) => [item.boardId, item])).values()
                ];
                update({ items, page, hasMore: result.hasMore });
            } catch (caught) {
                if (version === state.version)
                    update({ error: caught instanceof Error ? caught.message : "More drafts could not be loaded." });
            } finally {
                if (version === state.version) update({ loadingMore: false });
            }
        },
        async retryFeatured() {
            if (state.snapshot.loading || state.snapshot.loadingFeatured || !state.snapshot.failedIds.length) return;
            await readFeatured(state.snapshot.failedIds, state.version);
        }
    };
}
