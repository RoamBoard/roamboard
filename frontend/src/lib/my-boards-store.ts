import { mockBoardCollections } from "@/data/my-board-collections";
import { listPublishedBoards, loadBoardDocument, type PublishedSummary } from "./board-creator-api";
import { toGalleryBoard, type GalleryBoard } from "./my-boards";

export type MyBoardsState = {
    collection: GalleryBoard[];
    query: string;
    loading: boolean;
    error: string;
    preview: boolean;
    page: number;
    hasMore: boolean;
    loadingMore: boolean;
    failed: PublishedSummary[];
    retryingFailed: boolean;
};

async function readDocuments(summaries: PublishedSummary[]) {
    const results = await Promise.allSettled(
        summaries.map(async (summary) => toGalleryBoard(summary, await loadBoardDocument(summary.boardId)))
    );
    return {
        boards: results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
        failed: summaries.filter((_, index) => results[index].status === "rejected")
    };
}

function appendBoards(current: GalleryBoard[], incoming: GalleryBoard[]) {
    return [
        ...current,
        ...incoming.filter((board) => !current.some((existing) => existing.collage.id === board.collage.id))
    ];
}

// The page and its request-flow tests use this same state boundary and the real API helpers.
export function createMyBoardsStore() {
    const state: { snapshot: MyBoardsState; version: number } = {
        snapshot: {
            collection: [],
            query: "",
            loading: true,
            error: "",
            preview: false,
            page: 1,
            hasMore: false,
            loadingMore: false,
            failed: [],
            retryingFailed: false
        },
        version: 0
    };
    const listeners = new Set<() => void>();
    function update(patch: Partial<MyBoardsState>) {
        state.snapshot = { ...state.snapshot, ...patch };
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
        cancel() {
            state.version += 1;
        },
        setQuery(query: string) {
            update({ query });
        },
        async load() {
            const version = ++state.version;
            update({ loading: true, error: "", loadingMore: false, retryingFailed: false });
            try {
                const summaries = await listPublishedBoards(1);
                const result = await readDocuments(summaries.items);
                if (version !== state.version) return;
                update({
                    collection: result.boards,
                    failed: result.failed,
                    hasMore: summaries.hasMore,
                    page: 1,
                    preview: false
                });
            } catch (caught) {
                if (version !== state.version) return;
                update({
                    collection: mockBoardCollections.created,
                    preview: true,
                    hasMore: false,
                    failed: [],
                    error: caught instanceof Error ? caught.message : "Your Boards could not be loaded."
                });
            } finally {
                if (version === state.version) update({ loading: false });
            }
        },
        async loadMore() {
            if (
                state.snapshot.loading ||
                state.snapshot.loadingMore ||
                state.snapshot.retryingFailed ||
                !state.snapshot.hasMore
            )
                return;
            const version = state.version;
            const page = state.snapshot.page + 1;
            update({ loadingMore: true, error: "" });
            try {
                const summaries = await listPublishedBoards(page);
                const result = await readDocuments(summaries.items);
                if (version !== state.version) return;
                update({
                    collection: appendBoards(state.snapshot.collection, result.boards),
                    failed: [
                        ...state.snapshot.failed,
                        ...result.failed.filter(
                            (summary) => !state.snapshot.failed.some((item) => item.boardId === summary.boardId)
                        )
                    ],
                    page,
                    hasMore: summaries.hasMore
                });
            } catch (caught) {
                if (version === state.version)
                    update({ error: caught instanceof Error ? caught.message : "More Boards could not be loaded." });
            } finally {
                if (version === state.version) update({ loadingMore: false });
            }
        },
        async retryFailed() {
            if (
                state.snapshot.loading ||
                state.snapshot.loadingMore ||
                state.snapshot.retryingFailed ||
                !state.snapshot.failed.length
            )
                return;
            const version = state.version;
            update({ retryingFailed: true });
            try {
                const result = await readDocuments(state.snapshot.failed);
                if (version !== state.version) return;
                update({ collection: appendBoards(state.snapshot.collection, result.boards), failed: result.failed });
            } finally {
                if (version === state.version) update({ retryingFailed: false });
            }
        }
    };
}

export type MyBoardsStore = ReturnType<typeof createMyBoardsStore>;
