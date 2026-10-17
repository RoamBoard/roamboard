import assert from "node:assert/strict";
import test from "node:test";
import {
    filterSelectionBoards,
    parseSharedBoardId,
    selectionEditorHref,
    toSelectionBoard,
    type SelectionSummary
} from "../src/lib/board-selection";
import { createBoardSelectionStore } from "../src/lib/board-selection-store";
import { fromBoardDocument, saveBoardDocument, toBoardWrite, type BoardDocument } from "../src/lib/board-creator-api";

function summary(
    boardId: number,
    status: SelectionSummary["status"] = "draft",
    title = `Journey ${boardId}`,
    updatedAt = "2026-10-20T10:00:00Z"
): SelectionSummary {
    return { boardId, title, status, updatedAt, source: "owned", coverImageUrl: null };
}

function document(boardId: number, status: BoardDocument["status"] = "draft"): BoardDocument {
    return {
        author: { username: "test-author", bio: "", photo: null },
        boardId,
        revision: 12,
        status,
        title: `Journey ${boardId}`,
        description: "Notes from a slow afternoon.",
        visibility: "friends",
        coverImageId: 2,
        imageIds: [1, 2],
        tagIds: [107],
        tags: [{ tagId: 107, name: "Architecture" }],
        permissions: { canEditContent: true, canManageBoard: true },
        createdAt: "2026-10-19T10:00:00Z",
        updatedAt: "2026-10-20T10:00:00Z",
        images: [1, 2].map((imageId) => ({
            imageId,
            url: `/api/v1/images/${imageId}/content?variant=display`,
            thumbnailUrl: `/api/v1/images/${imageId}/content?variant=thumbnail`,
            capturedAt: null,
            position: imageId - 1
        })),
        days: [
            {
                dayId: boardId * 10,
                dayNumber: 1,
                date: null,
                activities: [
                    {
                        activityId: boardId * 100,
                        position: 0,
                        title: "Museum afternoon",
                        activityTime: "14:00",
                        category: "museum",
                        note: null,
                        source: "manual",
                        locationConfirmed: true,
                        uploadedImageIds: [1, 2],
                        coverImageId: 2,
                        externalImage: null,
                        location: {
                            name: "Museum",
                            address: null,
                            city: "Paris",
                            country: "France",
                            latitude: 48.86,
                            longitude: 2.33,
                            externalPlaceId: null
                        }
                    }
                ]
            }
        ]
    };
}

function page(items: SelectionSummary[], hasMore = false) {
    return Response.json({ data: items, meta: { hasMore } });
}

function failure(status: number, message: string) {
    return Response.json({ error: { message } }, { status });
}

function deferred<T>() {
    const state: { resolve?: (value: T) => void } = {};
    const promise = new Promise<T>((resolve) => {
        state.resolve = resolve;
    });
    return {
        promise,
        resolve(value: T) {
            assert.ok(state.resolve);
            state.resolve(value);
        }
    };
}

test("Continue reads both authenticated owner scopes, merges newest first, and retains Board identities", async (t) => {
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
        const url = new URL(input);
        requests.push(url.pathname + url.search);
        assert.equal(init.credentials, "include");
        assert.equal(init.cache, "no-store");
        assert.equal(init.method ?? "GET", "GET");
        assert.equal(url.pathname, "/api/v1/boards");
        return url.searchParams.get("scope") === "drafts"
            ? page([summary(11, "draft", "Draft", "2026-10-21T10:00:00Z")])
            : page([summary(22, "published", "Published", "2026-10-22T10:00:00Z")]);
    });
    const store = createBoardSelectionStore();
    assert.equal(store.getSnapshot().loading, true);
    await store.load();
    assert.deepEqual(requests.sort(), ["/api/v1/boards?scope=drafts&page=1", "/api/v1/boards?scope=published&page=1"]);
    assert.deepEqual(
        store.getSnapshot().items.map(({ boardId, status, source }) => ({ boardId, status, source })),
        [
            { boardId: 22, status: "published", source: "owned" },
            { boardId: 11, status: "draft", source: "owned" }
        ]
    );
    assert.equal(store.getSnapshot().loading, false);
    assert.equal(store.getSnapshot().scopes.draft.hasMore, false);
    assert.equal(store.getSnapshot().scopes.published.hasMore, false);
});

test("opening a Board refreshes its publication status and chooses its existing editor instead of creating a copy", async (t) => {
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        if (url.pathname === "/api/v1/boards")
            return page(url.searchParams.get("scope") === "drafts" ? [summary(19)] : []);
        assert.equal(url.pathname, "/api/v1/boards/19");
        return Response.json({ data: document(19, "published") });
    });
    const store = createBoardSelectionStore();
    await store.load();
    await store.loadPreview(19);
    const selected = store.getSnapshot().documents[19];
    assert.equal(store.getSnapshot().items[0].status, "published");
    assert.equal(selectionEditorHref(selected), "/boards/19/edit");
    assert.equal(selectionEditorHref(document(19)), "/boards/drafts/19");
    assert.equal(selected.revision, 12);
    assert.equal(selected.days[0].dayId, 190);
    assert.equal(selected.days[0].activities[0].activityId, 1900);
});

test("a failed owner scope leaves the successful collection usable and retries its first page without samples", async (t) => {
    const state = { failDrafts: true };
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        requests.push(url.search);
        if (url.searchParams.get("scope") === "published") return page([summary(8, "published")]);
        return state.failDrafts ? failure(503, "Drafts temporarily unavailable.") : page([summary(9)]);
    });
    const store = createBoardSelectionStore();
    await store.load();
    assert.deepEqual(
        store.getSnapshot().items.map((item) => item.boardId),
        [8]
    );
    assert.match(store.getSnapshot().scopes.draft.error, /Drafts temporarily unavailable/);
    assert.equal(store.getSnapshot().scopes.draft.page, 0);
    assert.equal(store.getSnapshot().scopes.published.error, "");
    state.failDrafts = false;
    await store.loadMore();
    assert.deepEqual(
        store.getSnapshot().items.map((item) => item.boardId),
        [9, 8]
    );
    assert.equal(store.getSnapshot().scopes.draft.page, 1);
    assert.equal(store.getSnapshot().scopes.draft.error, "");
    assert.deepEqual(requests.slice(2), ["?scope=drafts&page=1"]);
});

test("pagination preserves separate cursors, retries a failed page, and de-duplicates overlapping results", async (t) => {
    const state = { failPublished: true };
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        requests.push(url.search);
        const draft = url.searchParams.get("scope") === "drafts";
        if (url.searchParams.get("page") === "1")
            return page([summary(draft ? 1 : 2, draft ? "draft" : "published")], true);
        if (!draft && state.failPublished) return failure(503, "Published page unavailable.");
        return draft
            ? page([summary(1), summary(3), summary(3)])
            : page([summary(2, "published"), summary(4, "published")]);
    });
    const store = createBoardSelectionStore();
    await store.load();
    await store.loadMore();
    assert.deepEqual(
        store.getSnapshot().items.map((item) => item.boardId),
        [3, 2, 1]
    );
    assert.equal(store.getSnapshot().scopes.draft.page, 2);
    assert.equal(store.getSnapshot().scopes.draft.hasMore, false);
    assert.equal(store.getSnapshot().scopes.published.page, 1);
    assert.match(store.getSnapshot().scopes.published.error, /unavailable/);
    state.failPublished = false;
    await store.loadMore();
    assert.deepEqual(
        store.getSnapshot().items.map((item) => item.boardId),
        [4, 3, 2, 1]
    );
    assert.equal(store.getSnapshot().scopes.published.page, 2);
    assert.equal(store.getSnapshot().scopes.published.error, "");
    assert.deepEqual(requests.slice(4), ["?scope=published&page=2"]);
    await store.loadMore();
    assert.equal(requests.length, 5);
});

test("authentication and network failures produce an honest empty collection and remain retryable", async (t) => {
    const state = { unavailable: true };
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        if (!state.unavailable) return page([]);
        if (url.searchParams.get("scope") === "drafts") return failure(401, "Sign in to continue your Boards.");
        throw new Error("Network connection unavailable");
    });
    const store = createBoardSelectionStore();
    await store.load();
    assert.deepEqual(store.getSnapshot().items, []);
    assert.deepEqual(store.getSnapshot().documents, {});
    assert.match(store.getSnapshot().scopes.draft.error, /Sign in/);
    assert.match(store.getSnapshot().scopes.published.error, /API is unavailable/);
    assert.equal(store.getSnapshot().loading, false);
    state.unavailable = false;
    await store.load();
    assert.deepEqual(store.getSnapshot().items, []);
    assert.equal(store.getSnapshot().scopes.draft.error, "");
    assert.equal(store.getSnapshot().scopes.published.error, "");
});

test("preview requests reject viewers and mismatched identities, retain other successes, and can retry failures", async (t) => {
    const state = { allowOne: false };
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        if (url.pathname === "/api/v1/boards")
            return page(url.searchParams.get("scope") === "drafts" ? [1, 2, 3].map((id) => summary(id)) : []);
        const id = Number(url.pathname.split("/").at(-1));
        return Response.json({
            data:
                id === 1 && !state.allowOne
                    ? {
                          ...document(id),
                          description: "Sensitive notes that must never become a preview",
                          permissions: { canEditContent: false, canManageBoard: false }
                      }
                    : document(id === 2 ? 200 : id)
        });
    });
    const store = createBoardSelectionStore();
    await store.load();
    await Promise.all([1, 2, 3].map((id) => store.loadPreview(id)));
    const kept = store.getSnapshot().documents[3];
    assert.ok(kept);
    assert.equal(store.getSnapshot().documents[1], undefined);
    assert.equal(store.getSnapshot().documents[2], undefined);
    assert.match(store.getSnapshot().documentErrors[1], /permission/i);
    assert.match(store.getSnapshot().documentErrors[2], /verified/i);
    assert.deepEqual(store.getSnapshot().pendingIds, []);
    assert.doesNotMatch(JSON.stringify(store.getSnapshot()), /Sensitive notes/);
    assert.equal(
        selectionEditorHref({ ...document(1), permissions: { canEditContent: false, canManageBoard: true } }),
        null
    );
    state.allowOne = true;
    await store.loadPreview(1);
    assert.ok(store.getSnapshot().documents[1]);
    assert.equal(store.getSnapshot().documentErrors[1], "");
    assert.equal(store.getSnapshot().documents[3], kept);
});

test("shared Board links use current edit permission, preserve identity, and do not invent ownership", async (t) => {
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
        requests.push(new URL(input).pathname);
        assert.equal(init.credentials, "include");
        return Response.json({
            data: { ...document(42, "published"), permissions: { canEditContent: true, canManageBoard: false } }
        });
    });
    const store = createBoardSelectionStore();
    await store.loadSharedBoard("https://roamboard.test/boards/42");
    const state = store.getSnapshot();
    assert.equal(state.sharedBoardId, 42);
    assert.equal(state.sharedLoading, false);
    assert.equal(state.sharedError, "");
    assert.equal(state.items[0].source, "shared");
    assert.equal(state.items[0].status, "published");
    assert.equal(selectionEditorHref(state.documents[42]), "/boards/42/edit");
    assert.equal(toSelectionBoard(state.items[0], state.documents[42]).collage.author, "");
    assert.deepEqual(requests, ["/api/v1/boards/42"]);
});

test("shared lookup validates input before fetching and rejects inaccessible, viewer, and mismatched Boards", async (t) => {
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const path = new URL(input).pathname;
        requests.push(path);
        if (path.endsWith("/1")) return failure(404, "Board not found.");
        return Response.json({
            data: path.endsWith("/2")
                ? { ...document(2, "published"), permissions: { canEditContent: false, canManageBoard: false } }
                : document(999, "published")
        });
    });
    const store = createBoardSelectionStore();
    for (const input of ["", "0", "-2", "1.5", "9007199254740992", "/boards/new", "not a board"])
        await store.loadSharedBoard(input);
    assert.deepEqual(requests, []);
    assert.match(store.getSnapshot().sharedError, /Board link|Board ID/);
    for (const input of ["1", "2", "3"]) {
        await store.loadSharedBoard(input);
        assert.equal(store.getSnapshot().sharedBoardId, null);
        assert.deepEqual(store.getSnapshot().items, []);
        assert.deepEqual(store.getSnapshot().documents, {});
        assert.ok(store.getSnapshot().sharedError);
        assert.equal(store.getSnapshot().sharedLoading, false);
    }
    for (const input of [
        " 42 ",
        "/boards/42",
        "/boards/42/edit",
        "/boards/drafts/42",
        "https://roamboard.test/boards/42?source=shared#title"
    ])
        assert.equal(parseSharedBoardId(input), 42);
});

test("shared lookup of an owned Board retains ownership and does not duplicate its card", async (t) => {
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        if (url.pathname === "/api/v1/boards")
            return page(url.searchParams.get("scope") === "drafts" ? [summary(7)] : []);
        return Response.json({ data: document(7) });
    });
    const store = createBoardSelectionStore();
    await store.load();
    await store.loadSharedBoard("7");
    assert.equal(store.getSnapshot().items.length, 1);
    assert.equal(store.getSnapshot().items[0].source, "owned");
    assert.equal(store.getSnapshot().items[0].boardId, 7);
});

test("a canceled list cannot replace a newer collection or its scope cursors", async (t) => {
    const pending = deferred<Response>();
    const state = { fresh: false };
    t.mock.method(globalThis, "fetch", async () => (state.fresh ? page([summary(50)]) : pending.promise));
    const store = createBoardSelectionStore();
    const old = store.load();
    store.cancel();
    state.fresh = true;
    await store.load();
    const fresh = store.getSnapshot();
    pending.resolve(page([summary(10)], true));
    await old;
    assert.equal(store.getSnapshot(), fresh);
    assert.deepEqual(
        store.getSnapshot().items.map((item) => item.boardId),
        [50]
    );
    assert.equal(store.getSnapshot().scopes.draft.hasMore, false);
    assert.equal(store.getSnapshot().scopes.published.hasMore, false);
});

test("reloading clears the previous collection, preview permissions, and failures before fresh account data arrives", async (t) => {
    const pending = deferred<Response>();
    const state = { refresh: false };
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        if (url.pathname === "/api/v1/boards") {
            if (state.refresh) return pending.promise;
            return page(url.searchParams.get("scope") === "drafts" ? [summary(1), summary(2)] : []);
        }
        if (url.pathname.endsWith("/2")) return failure(404, "Previous account Board unavailable.");
        return Response.json({ data: document(1) });
    });
    const store = createBoardSelectionStore();
    await store.load();
    await Promise.all([store.loadPreview(1), store.loadPreview(2)]);
    assert.ok(store.getSnapshot().documents[1]);
    assert.ok(store.getSnapshot().documentErrors[2]);
    state.refresh = true;
    const refreshing = store.load();
    assert.equal(store.getSnapshot().loading, true);
    assert.deepEqual(store.getSnapshot().items, []);
    assert.deepEqual(store.getSnapshot().documents, {});
    assert.deepEqual(store.getSnapshot().documentErrors, {});
    assert.deepEqual(store.getSnapshot().pendingIds, []);
    pending.resolve(page([summary(3)]));
    await refreshing;
    assert.deepEqual(
        store.getSnapshot().items.map((item) => item.boardId),
        [3]
    );
    assert.deepEqual(store.getSnapshot().documents, {});
    assert.equal(store.getSnapshot().loading, false);
});

test("concurrent pagination submits one pair of pages and canceled pages cannot append to a refreshed list", async (t) => {
    const pending = deferred<Response>();
    const state = { fresh: false };
    const nextPages: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        if (url.searchParams.get("page") === "2") {
            nextPages.push(url.search);
            return pending.promise;
        }
        return page([summary(state.fresh ? 60 : 1)], true);
    });
    const store = createBoardSelectionStore();
    await store.load();
    const next = store.loadMore();
    await store.loadMore();
    assert.equal(nextPages.length, 2);
    store.cancel();
    state.fresh = true;
    await store.load();
    pending.resolve(page([summary(2)]));
    await next;
    assert.deepEqual(
        store.getSnapshot().items.map((item) => item.boardId),
        [60]
    );
    assert.equal(store.getSnapshot().loadingMore, false);
    assert.equal(store.getSnapshot().scopes.draft.page, 1);
    assert.equal(store.getSnapshot().scopes.published.page, 1);
});

test("cancellation ignores late preview and shared-link reads without changing the current snapshot", async (t) => {
    const pending = deferred<Response>();
    t.mock.method(globalThis, "fetch", async () => pending.promise);
    const store = createBoardSelectionStore();
    const preview = store.loadPreview(21);
    const shared = store.loadSharedBoard("21");
    assert.ok(store.getSnapshot().pendingIds.includes(21));
    assert.equal(store.getSnapshot().sharedLoading, true);
    store.cancel();
    const canceled = store.getSnapshot();
    pending.resolve(Response.json({ data: document(21) }));
    await Promise.all([preview, shared]);
    assert.equal(store.getSnapshot(), canceled);
    assert.deepEqual(store.getSnapshot().documents, {});
    assert.deepEqual(store.getSnapshot().items, []);
});

test("title search and publication filters match loaded summaries without mutation or invented searchable fields", () => {
    const items = [
        summary(1, "draft", "Café walks Paris"),
        summary(2, "published", "Paris cafés"),
        summary(3, "draft", "")
    ];
    const original = structuredClone(items);
    assert.deepEqual(
        filterSelectionBoards(items, "  CAFE PARIS ").map((item) => item.boardId),
        [1, 2]
    );
    assert.deepEqual(
        filterSelectionBoards(items, "paris", "draft").map((item) => item.boardId),
        [1]
    );
    assert.deepEqual(
        filterSelectionBoards(items, "", "published").map((item) => item.boardId),
        [2]
    );
    assert.deepEqual(
        filterSelectionBoards(items, "untitled").map((item) => item.boardId),
        [3]
    );
    assert.deepEqual(filterSelectionBoards(items, "architecture"), []);
    assert.deepEqual(filterSelectionBoards(items, "missing unloaded journey"), []);
    assert.deepEqual(items, original);
});

test("card adaptation uses real media and confirmed destinations and never fabricates unavailable cover or metadata", () => {
    const board = document(30);
    board.days[0].activities.push({
        ...board.days[0].activities[0],
        activityId: 3001,
        locationConfirmed: false,
        location: { ...board.days[0].activities[0].location!, city: "Kyoto", country: "Japan" }
    });
    const original = structuredClone(board);
    const selected = toSelectionBoard(summary(30), board);
    assert.equal(selected.destination, "Paris, France");
    assert.equal(selected.collage.destinationLabel, "FRA");
    assert.match(selected.collage.images[0].src, /\/images\/2\/content\?variant=thumbnail$/);
    assert.match(selected.photo?.image.src ?? "", /\/images\/2\/content\?variant=thumbnail$/);
    assert.equal(selected.collage.savedCount, undefined);
    assert.deepEqual(board, original);
    const empty = toSelectionBoard({ ...summary(31), source: "shared" });
    assert.equal(empty.collage.author, "");
    assert.equal(empty.destination, "");
    assert.equal(empty.collage.destinationLabel, "");
    assert.deepEqual(empty.collage.images, []);
    assert.equal(empty.photo, null);
});

test("continuing a published Board saves to the original identity and revision without downgrading or copying", async (t) => {
    const requests: Array<{ path: string; method: string; body?: Record<string, unknown> }> = [];
    t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
        const url = new URL(input);
        requests.push({
            path: url.pathname,
            method: init.method ?? "GET",
            body: init.body ? JSON.parse(String(init.body)) : undefined
        });
        assert.equal(init.credentials, "include");
        return Response.json({ data: { ...document(71, "published"), revision: init.method === "PUT" ? 13 : 12 } });
    });
    const store = createBoardSelectionStore();
    await store.loadSharedBoard("/boards/71");
    const selected = store.getSnapshot().documents[71];
    assert.equal(selectionEditorHref(selected), "/boards/71/edit");
    const restored = fromBoardDocument(selected);
    const write = toBoardWrite(
        {
            title: "An improved journey",
            description: selected.description ?? "",
            status: selected.status,
            visibility: selected.visibility,
            coverImageId: selected.coverImageId,
            tags: selected.tags.map((tag) => tag.name),
            ...restored
        },
        selected.tags,
        restored.confirmedPhotoPins
    );
    await saveBoardDocument(write, selected);
    assert.deepEqual(
        requests.map(({ path, method }) => [path, method]),
        [
            ["/api/v1/boards/71", "GET"],
            ["/api/v1/boards/71", "PUT"]
        ]
    );
    assert.equal(requests[1].body?.revision, 12);
    assert.equal(requests[1].body?.status, "published");
    assert.equal(write.days[0].dayId, 710);
    assert.equal(write.days[0].activities[0].activityId, 7100);
    assert.deepEqual(write.days[0].activities[0].uploadedImageIds, [1, 2]);
});
