import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
    BoardSelectionCollection,
    BoardSelectionGallery
} from "../src/components/features/boards/BoardSelectionGallery";
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
        boardId,
        author: { username: "owner", bio: "", photo: null },
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
    assert.match(selected.photo.image?.src ?? "", /\/images\/2\/content\?variant=display$/);
    assert.equal(selected.photo.author, board.author.username);
    assert.equal(selected.photo.destination, "Paris, France");
    assert.deepEqual(selected.photo.tags, ["Architecture"]);
    assert.equal(selected.photo.description, board.description);
    assert.equal(selected.photo.status, "draft");
    assert.equal(selected.photo.visibility, "friends");
    assert.equal(selected.photo.savedCount, undefined);
    assert.equal(selected.ownership, "owner");
    assert.equal(selected.collage.savedCount, undefined);
    assert.deepEqual(board, original);
    const empty = toSelectionBoard({ ...summary(31), source: "shared" });
    assert.equal(empty.collage.author, "");
    assert.equal(empty.destination, "");
    assert.equal(empty.collage.destinationLabel, "");
    assert.deepEqual(empty.collage.images, []);
    assert.equal(empty.photo.title, "Journey 31");
    assert.equal(empty.photo.image, undefined);
    assert.equal(empty.photo.author, "");
    assert.equal(empty.photo.destination, "");
    assert.equal(empty.photo.durationDays, undefined);
    assert.equal(empty.photo.savedCount, undefined);
    assert.equal(empty.ownership, "unknown");
});

test("Continue ownership follows explicit owner context or management permission, never shared edit access", () => {
    const shared = { ...summary(81, "published"), source: "shared" as const };
    const editor = {
        ...document(81, "published"),
        author: { username: "you", bio: "", photo: null },
        permissions: { canEditContent: true, canManageBoard: false }
    };
    const board = toSelectionBoard(shared, editor);
    assert.equal(board.ownership, "other");
    assert.equal(board.photo.author, "you", "Displayed attribution must not become an ownership check");
    assert.equal(selectionEditorHref(editor), "/boards/81/edit");
    assert.equal(toSelectionBoard(shared).ownership, "unknown");
    assert.equal(toSelectionBoard(shared, document(81, "published")).ownership, "owner");
    const owned = toSelectionBoard(summary(81), { ...editor, status: "draft" });
    assert.equal(owned.ownership, "owner", "The authenticated owned-list source establishes ownership");
});

test("an owner opened through a shared-link lookup keeps owner annotations rather than shared-editor copy", () => {
    const board = toSelectionBoard({ ...summary(82, "published"), source: "shared" }, document(82, "published"));
    const markup = selectionMarkup([board]);
    assert.match(markup, />Your Board<\/dt>/);
    assert.match(markup, /Published · Friends/);
    assert.doesNotMatch(markup, /Shared with you|Published · editing access/);
    assert.match(markup, /href="\/boards\/82\/edit"/);
});

function selectionMarkup(boards: ReturnType<typeof toSelectionBoard>[], selected = boards[0], error?: string) {
    return renderToStaticMarkup(
        createElement(BoardSelectionGallery, {
            boards,
            selected,
            error,
            onSelect: () => {},
            onRetry: () => {}
        })
    );
}

test("Continue arrows wrap between real Boards and retain the selected card's canonical editor link in both layouts", () => {
    type Props = { children?: ReactNode; onClick?: () => void; [key: string]: unknown };
    function elements(node: ReactNode): Array<{ type: unknown; props: Props }> {
        if (!isValidElement<Props>(node)) return [];
        return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(elements)];
    }
    const boards = [
        toSelectionBoard(summary(301, "published"), document(301, "published")),
        toSelectionBoard(summary(302), document(302)),
        toSelectionBoard(summary(303, "published"), document(303, "published"))
    ];
    for (const compact of [false, true]) {
        for (const index of [0, 1, 2]) {
            const selections: number[] = [];
            const captured: { nodes: ReturnType<typeof elements> } = { nodes: [] };
            function Probe() {
                const tree = BoardSelectionGallery({
                    boards,
                    selected: boards[index],
                    compact,
                    onSelect: (boardId) => selections.push(boardId),
                    onRetry() {}
                });
                captured.nodes = elements(tree);
                return tree;
            }
            const html = renderToStaticMarkup(createElement(Probe));
            const previous = captured.nodes.find((node) => node.props["aria-label"] === "Previous Board");
            const next = captured.nodes.find((node) => node.props["aria-label"] === "Next Board");
            assert.ok(previous?.props.onClick);
            assert.ok(next?.props.onClick);
            previous.props.onClick();
            next.props.onClick();
            assert.deepEqual(selections, [
                boards[(index + 2) % 3].summary.boardId,
                boards[(index + 1) % 3].summary.boardId
            ]);
            assert.ok(html.includes(`href="${selectionEditorHref(boards[index].document!)}"`));
            assert.equal(html.match(/aria-label="Previous Board"/g)?.length, 1);
            assert.equal(html.match(/aria-label="Next Board"/g)?.length, 1);
            const controls = captured.nodes.find((node) => node.props["aria-label"] === "Board selection controls");
            assert.ok(controls);
            assert.equal(controls.props.role, "group");
            const controlButtons = Children.toArray(controls.props.children)
                .flatMap(elements)
                .filter((node) => node.type === "button")
                .map((node) => node.props["aria-label"]);
            assert.deepEqual(controlButtons, ["Previous Board", "Next Board"]);
            assert.doesNotMatch(html, /sm:order-|CONTINUE BOARD/);
        }
    }
});

function annotationGroups(markup: string) {
    return [...markup.matchAll(/<dl\b[^>]*>([\s\S]*?)<\/dl>/g)].map((match) =>
        match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
    );
}

test("Continue annotations use canonical publication visibility and keep traveler saves separate from itinerary", () => {
    for (const [visibility, label] of [
        ["public", "Public"],
        ["friends", "Friends"],
        ["collaborators", "Restricted access"]
    ] as const) {
        const selected = toSelectionBoard(summary(83, "published"), { ...document(83, "published"), visibility });
        selected.photo = { ...selected.photo, visibility: "public", savedCount: 128 };
        const groups = annotationGroups(selectionMarkup([selected]));
        assert.ok(groups.length > 0, "The selected Board has a readable description list");
        for (const group of groups) {
            assert.ok(group.includes(`Your Board Published · ${label}`));
            assert.match(group, /In this Board 1 day · 1 activity/);
            assert.match(group, /Saves received 128 saves/);
            assert.doesNotMatch(group, /1 activity[^a-zA-Z]*128 saves|[Pp]rivate|[Cc]ollaborat/);
        }
    }
    const draft = toSelectionBoard(summary(84), { ...document(84), visibility: "public" });
    for (const group of annotationGroups(selectionMarkup([draft]))) {
        assert.match(group, /Your Board Unpublished draft · Only you/);
        assert.doesNotMatch(group, /Saves received|\bPublic\b/);
    }
});

test("Continue receives the canonical save total through its real adapter, including zero", () => {
    for (const count of [0, 1, 1200]) {
        const selected = toSelectionBoard(summary(85, "published"), {
            ...document(85, "published"),
            savedCount: count
        });
        assert.equal(selected.photo.savedCount, count);
        for (const group of annotationGroups(selectionMarkup([selected])))
            assert.ok(
                group.includes(
                    `Saves received ${new Intl.NumberFormat("en-US").format(count)} ${count === 1 ? "save" : "saves"}`
                )
            );
    }
});

test("Continue annotates zero saves honestly and omits invalid or unavailable save counts", () => {
    const selected = toSelectionBoard(summary(85, "published"), document(85, "published"));
    for (const value of [undefined, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
        selected.photo = { ...selected.photo, savedCount: value };
        for (const group of annotationGroups(selectionMarkup([selected]))) {
            assert.doesNotMatch(group, /Saves received|\bsaves?\b/);
        }
    }
    selected.photo = { ...selected.photo, savedCount: 0 };
    for (const group of annotationGroups(selectionMarkup([selected]))) assert.match(group, /Saves received 0 saves/);
    selected.photo = { ...selected.photo, savedCount: 1 };
    for (const group of annotationGroups(selectionMarkup([selected]))) assert.match(group, /Saves received 1 save\b/);
});

test("Continue summaries show only known visibility and never invent missing itinerary or saves", () => {
    const unknown = toSelectionBoard(summary(86, "published"));
    for (const group of annotationGroups(selectionMarkup([unknown]))) {
        assert.match(group, /Your Board Published/);
        assert.doesNotMatch(group, /Public|Friends|Restricted access|In this Board|Saves received/);
    }
    const known = toSelectionBoard({ ...summary(87, "published"), visibility: "collaborators" });
    for (const group of annotationGroups(selectionMarkup([known]))) {
        assert.match(group, /Your Board Published · Restricted access/);
        assert.doesNotMatch(group, /[Pp]rivate|In this Board|Saves received/);
    }
});

function v4Cards(markup: string) {
    return [...markup.matchAll(/<article\b[^>]*style="aspect-ratio:400 \/ 500"[^>]*>[\s\S]*?<\/article>/g)].map(
        (match) => match[0]
    );
}

test("Continue opens the selected Board through its card, while other cards select first and editing stays permission-gated", () => {
    const owned = toSelectionBoard(summary(91, "published"), { ...document(91, "published"), visibility: "public" });
    const shared = toSelectionBoard(
        { ...summary(92, "published"), source: "shared" },
        { ...document(92, "published"), permissions: { canEditContent: true, canManageBoard: false } }
    );
    const markup = selectionMarkup([owned, shared]);
    const cards = v4Cards(markup);
    assert.equal(cards.length, 2);
    assert.match(cards[0], /aria-label="Public — anyone can view this Board"/);
    assert.match(cards[0], /Architecture/);
    assert.match(cards[0], /Paris, France/);
    assert.match(cards[0], /href="\/boards\/91\/edit"/);
    assert.match(cards[0], /aria-label="Edit Journey 91"/);
    assert.match(cards[0], /lucide-pencil/);
    assert.match(cards[0], /aria-label="Show details for Journey 91" aria-expanded="false" aria-controls=/);
    assert.match(cards[1], /aria-label="Focus Journey 92"/);
    assert.doesNotMatch(cards[1], /href="\/boards\/92"/);
    assert.match(cards[1], /tabindex="-1"/);
    assert.match(cards[1], /aria-label="Friends — you, your friends and invited Board members can view this Board"/);
    assert.doesNotMatch(cards[1], /aria-label="(?:Save|Unsave|Edit) /);
    assert.match(markup, /href="\/boards\/91\/edit"/);
    assert.doesNotMatch(markup, /href="\/boards\/92\/edit"/);
    assert.match(markup, /aria-label="Previous Board"/);
    assert.match(markup, /aria-label="Next Board"/);
    assert.match(markup, /aria-live="polite"/);
    assert.doesNotMatch(markup, /CONTINUE BOARD|RECENTLY|a journey, still unfolding/);
    assert.doesNotMatch(markup, />(?:Details|Close)(?:<|$)|[\d,]+ saves/);
    assert.doesNotMatch(markup, /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<button\b/);
    const revoked = toSelectionBoard(summary(91, "published"), {
        ...document(91, "published"),
        permissions: { canEditContent: false, canManageBoard: false }
    });
    const denied = selectionMarkup([revoked]);
    assert.doesNotMatch(denied, /href="\/boards\/91\/edit"/);
    assert.match(denied, /Editing unavailable/);
    assert.doesNotMatch(denied, /Checking edit access/);
});

test("summary-only Continue cards remain V4 without pretending that cover, ownership or edit access has resolved", () => {
    const ownedDraft = toSelectionBoard(summary(93));
    const featured = selectionMarkup([ownedDraft]);
    assert.equal(v4Cards(featured).length, 1);
    assert.match(featured, /No cover photo/);
    assert.match(featured, /Draft — only you can view this Board/);
    assert.doesNotMatch(featured, /href="\/boards\/(?:drafts\/)?93(?:\/edit)?"/);
    assert.match(featured, /Checking edit access/);
    const shared = toSelectionBoard({ ...summary(94, "published"), source: "shared" });
    const collection = renderToStaticMarkup(
        createElement(BoardSelectionCollection, { boards: [shared], onSelect: () => {} })
    );
    assert.equal(v4Cards(collection).length, 1);
    assert.match(collection, /aria-label="Focus Journey 94 from collection"/);
    assert.doesNotMatch(collection, /href=/);
    assert.match(collection, /No cover photo/);
    assert.doesNotMatch(
        collection,
        /aria-label="(?:Save|Unsave|Public|Friends|Restricted access) |href="\/boards\/94\/edit"|[\d,]+ saves/
    );
    assert.doesNotMatch(collection, /Room for memories|by you|Destination not added/);
});

test("an owned published summary exposes its actual visibility and cover without inventing optional metadata or edit access", () => {
    const item: SelectionSummary = {
        ...summary(96, "published", "A title without a claimed destination"),
        visibility: "friends",
        coverImageUrl: "/api/v1/images/96/content?variant=thumbnail"
    };
    const board = toSelectionBoard(item);
    assert.equal(board.photo.status, "published");
    assert.equal(board.photo.visibility, "friends");
    assert.equal(board.photo.author, "");
    assert.equal(board.photo.destination, "");
    assert.equal(board.photo.savedCount, undefined);
    assert.equal(board.photo.durationDays, undefined);
    assert.match(board.photo.image?.src ?? "", /\/api\/v1\/images\/96\/content\?variant=thumbnail$/);
    const markup = selectionMarkup([board]);
    assert.match(markup, /Friends — you, your friends and invited Board members/);
    assert.doesNotMatch(markup, /href="\/boards\/96\/edit"|by you|[\d,]+ saves/);
    assert.match(markup, /Checking edit access/);
});

test("a failed real Continue preview keeps V4 selectable and enables only the original editor after successful retry", async (t) => {
    const requests: string[] = [];
    const access = { allowed: false };
    t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
        const url = new URL(input);
        requests.push(url.pathname + url.search);
        assert.equal(init.credentials, "include");
        if (url.pathname === "/api/v1/boards")
            return page(url.searchParams.get("scope") === "drafts" ? [summary(95)] : []);
        return access.allowed ? Response.json({ data: document(95) }) : failure(403, "Editing access unavailable.");
    });
    const store = createBoardSelectionStore();
    await store.load();
    await store.loadPreview(95);
    const failed = toSelectionBoard(store.getSnapshot().items[0], store.getSnapshot().documents[95]);
    const unavailable = selectionMarkup([failed], failed, store.getSnapshot().documentErrors[95]);
    assert.equal(v4Cards(unavailable).length, 1);
    assert.match(unavailable, /Editing access unavailable/);
    assert.match(unavailable, /Retry access and preview/);
    assert.doesNotMatch(unavailable, /href="\/boards\/drafts\/95"/);
    access.allowed = true;
    await store.loadPreview(95);
    const ready = toSelectionBoard(store.getSnapshot().items[0], store.getSnapshot().documents[95]);
    assert.match(selectionMarkup([ready]), /href="\/boards\/drafts\/95"/);
    assert.equal(store.getSnapshot().documents[95].revision, 12);
    assert.deepEqual(requests.slice(2), ["/api/v1/boards/95", "/api/v1/boards/95"]);
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
        selected.tags
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
