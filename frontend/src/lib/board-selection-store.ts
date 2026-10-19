import { loadSavedBoardsPage, ProfileApiError } from "./profile";
import { listBoardDrafts, listPublishedBoards, loadBoardDocument, type BoardDocument } from "./board-creator-api";
import { parseSharedBoardId, type SelectionSummary } from "./board-selection";

type Scope = "draft" | "published";
type PageState = { page: number; hasMore: boolean; error: string };
export type BoardSelectionState = {
    items: SelectionSummary[];
    documents: Record<number, BoardDocument>;
    documentErrors: Record<number, string>;
    pendingIds: number[];
    scopes: Record<Scope, PageState>;
    loading: boolean;
    loadingMore: boolean;
    sharedLoading: boolean;
    sharedError: string;
    sharedBoardId: number | null;
};
type Dependencies = {
    listSaved?: typeof loadSavedBoardsPage;
    listDrafts: typeof listBoardDrafts;
    listPublished: typeof listPublishedBoards;
    loadDocument: typeof loadBoardDocument;
};
const emptyPage = (): PageState => ({ page: 0, hasMore: true, error: "" });
const errorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Boards could not be loaded. Try again.";

// Each production owner scope has its own cursor. A failed page never advances its cursor.
export function createBoardSelectionStore(
    deps: Dependencies = {
        listDrafts: listBoardDrafts,
        listPublished: listPublishedBoards,
        loadDocument: loadBoardDocument
    },
    mode: "continue" | "remix" = "continue"
) {
    const state: { snapshot: BoardSelectionState; version: number; sharedVersion: number } = {
        version: 0,
        sharedVersion: 0,
        snapshot: {
            items: [],
            documents: {},
            documentErrors: {},
            pendingIds: [],
            scopes: { draft: emptyPage(), published: emptyPage() },
            loading: true,
            loadingMore: false,
            sharedLoading: false,
            sharedError: "",
            sharedBoardId: null
        }
    };
    const listeners = new Set<() => void>();
    const update = (patch: Partial<BoardSelectionState>) => {
        state.snapshot = { ...state.snapshot, ...patch };
        listeners.forEach((listener) => listener());
    };
    const merge = (items: SelectionSummary[]) =>
        [...new Map(items.map((item) => [item.boardId, item])).values()].sort(
            (a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.boardId - a.boardId
        );
    function validate(document: BoardDocument, id: number) {
        if (document.boardId !== id) throw new Error("This Board could not be verified. Try again.");
        if (mode === "continue" && !document.permissions.canEditContent)
            throw new Error("You don’t have permission to edit this Board.");
        if (mode === "remix" && (document.status !== "published" || !document.savedByMe))
            throw new Error("This saved Board is no longer available.");
        return document;
    }
    async function readSavedPage(page: number) {
        const result = await (deps.listSaved ?? loadSavedBoardsPage)(page, 20);
        return {
            items: result.data.map((board) => ({
                boardId: board.boardId,
                title: board.title,
                coverImageUrl: board.coverImageUrl,
                updatedAt: board.savedAt
            })),
            hasMore: result.meta?.hasMore ?? false
        };
    }
    async function readPages(initial: boolean) {
        const version = initial ? ++state.version : state.version;
        const scopes = (["draft", "published"] as const).filter(
            (scope) =>
                (mode === "continue" || scope === "published") && (initial || state.snapshot.scopes[scope].hasMore)
        );
        update(
            initial
                ? {
                      items: [],
                      documents: {},
                      documentErrors: {},
                      scopes: { draft: emptyPage(), published: emptyPage() },
                      sharedBoardId: null,
                      sharedError: "",
                      loading: true,
                      loadingMore: false,
                      pendingIds: [],
                      sharedLoading: false
                  }
                : { loadingMore: true }
        );
        await Promise.all(
            scopes.map(async (scope) => {
                const page = initial ? 1 : state.snapshot.scopes[scope].page + 1;
                try {
                    const result =
                        mode === "remix"
                            ? await readSavedPage(page)
                            : await (scope === "draft" ? deps.listDrafts(page) : deps.listPublished(page));
                    if (version !== state.version) return;
                    const items = result.items.map((item) => ({
                        ...item,
                        status: scope,
                        source: mode === "remix" ? ("saved" as const) : ("owned" as const)
                    }));
                    const existing = initial
                        ? state.snapshot.items.filter((item) => item.source === "shared" || item.status !== scope)
                        : state.snapshot.items;
                    update({
                        items: merge([...existing, ...items]),
                        scopes: { ...state.snapshot.scopes, [scope]: { page, hasMore: result.hasMore, error: "" } }
                    });
                } catch (error) {
                    if (version !== state.version) return;
                    if (mode === "remix" && error instanceof ProfileApiError && error.status === 401)
                        update({ items: [], documents: {}, documentErrors: {} });
                    update({
                        scopes: {
                            ...state.snapshot.scopes,
                            [scope]: {
                                ...(initial ? emptyPage() : state.snapshot.scopes[scope]),
                                error: errorMessage(error)
                            }
                        }
                    });
                }
            })
        );
        if (version === state.version) update({ loading: false, loadingMore: false });
    }
    async function loadPreview(id: number) {
        if (state.snapshot.pendingIds.includes(id) || state.snapshot.documents[id]) return;
        const version = state.version;
        update({
            pendingIds: [...state.snapshot.pendingIds, id],
            documentErrors: { ...state.snapshot.documentErrors, [id]: "" }
        });
        try {
            const document = validate(await deps.loadDocument(id), id);
            if (version !== state.version) return;
            update({
                documents: { ...state.snapshot.documents, [id]: document },
                items: merge(
                    state.snapshot.items.map((item) =>
                        item.boardId === id
                            ? {
                                  ...item,
                                  status: document.status,
                                  title: document.title,
                                  updatedAt: mode === "remix" ? item.updatedAt : document.updatedAt
                              }
                            : item
                    )
                )
            });
        } catch (error) {
            if (version === state.version)
                update({ documentErrors: { ...state.snapshot.documentErrors, [id]: errorMessage(error) } });
        } finally {
            if (version === state.version)
                update({ pendingIds: state.snapshot.pendingIds.filter((pending) => pending !== id) });
        }
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
            state.sharedVersion += 1;
        },
        async load() {
            state.sharedVersion += 1;
            await readPages(true);
        },
        async loadMore() {
            if (!state.snapshot.loading && !state.snapshot.loadingMore) await readPages(false);
        },
        loadPreview,
        async loadSharedBoard(input: string) {
            if (state.snapshot.sharedLoading) return;
            const version = state.version;
            const sharedVersion = ++state.sharedVersion;
            update({ sharedLoading: true, sharedError: "", sharedBoardId: null });
            try {
                const id = parseSharedBoardId(input);
                const document = validate(await deps.loadDocument(id), id);
                if (version !== state.version || sharedVersion !== state.sharedVersion) return;
                const existing = state.snapshot.items.find((item) => item.boardId === id);
                const summary: SelectionSummary = {
                    boardId: id,
                    title: document.title,
                    status: document.status,
                    source: existing?.source ?? "shared",
                    updatedAt: document.updatedAt,
                    coverImageUrl:
                        document.images.find((image) => image.imageId === document.coverImageId)?.thumbnailUrl ?? null
                };
                update({
                    items: merge([...state.snapshot.items, summary]),
                    documents: { ...state.snapshot.documents, [id]: document },
                    sharedBoardId: id
                });
            } catch (error) {
                if (version === state.version && sharedVersion === state.sharedVersion)
                    update({ sharedError: errorMessage(error) });
            } finally {
                if (version === state.version && sharedVersion === state.sharedVersion)
                    update({ sharedLoading: false });
            }
        }
    };
}
export type BoardSelectionStore = ReturnType<typeof createBoardSelectionStore>;
