import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { createDraftBoardsStore, filterDraftBoards } from "../src/lib/draft-boards-store";
import { DraftBoardListContent } from "../src/components/features/boards/DraftBoardList";
import {
    fromBoardDocument,
    loadBoardDocument,
    saveBoardDocument,
    toBoardWrite,
    type BoardDocument,
    type DraftSummary
} from "../src/lib/board-creator-api";

function summary(boardId: number, title = `Draft journey ${boardId}`): DraftSummary {
    return {
        boardId,
        title,
        updatedAt: "2026-10-20T10:00:00Z",
        coverImageUrl: `/api/v1/images/${boardId}/content?variant=thumbnail`
    };
}

function document(boardId: number): BoardDocument {
    return {
        boardId,
        author: { username: "owner", bio: "", photo: null },
        revision: 8,
        status: "draft",
        title: `Draft journey ${boardId}`,
        description: `Draft notes ${boardId}`,
        visibility: "friends",
        coverImageId: boardId,
        imageIds: [boardId],
        tagIds: [104],
        tags: [{ tagId: 104, name: "Museums" }],
        permissions: { canEditContent: true, canManageBoard: true },
        createdAt: "2026-10-19T10:00:00Z",
        updatedAt: "2026-10-20T10:00:00Z",
        images: [
            {
                imageId: boardId,
                url: `/api/v1/images/${boardId}/content?variant=display`,
                thumbnailUrl: `/api/v1/images/${boardId}/content?variant=thumbnail`,
                capturedAt: null,
                position: 0
            }
        ],
        days: [
            {
                dayId: boardId * 10,
                dayNumber: 1,
                date: null,
                activities: [
                    {
                        activityId: boardId * 100,
                        position: 0,
                        title: `Museum ${boardId}`,
                        activityTime: "09:00",
                        category: "museum",
                        note: null,
                        source: "manual",
                        locationConfirmed: true,
                        uploadedImageIds: [boardId],
                        coverImageId: boardId,
                        externalImage: null,
                        location: {
                            name: `Museum ${boardId}`,
                            address: null,
                            city: "Stockholm",
                            country: "Sweden",
                            latitude: 59.32,
                            longitude: 18.06,
                            externalPlaceId: null
                        }
                    }
                ]
            }
        ]
    };
}

function list(items: DraftSummary[], hasMore = false) {
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

test("draft list uses authenticated draft pagination and loads full documents only for the first five featured drafts", async (t) => {
    const calls: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
        const url = new URL(input);
        calls.push(url.pathname + url.search);
        assert.equal(init.credentials, "include");
        return url.pathname === "/api/v1/boards"
            ? list(
                  Array.from({ length: 8 }, (_, index) => summary(index + 1)),
                  true
              )
            : Response.json({ data: document(Number(url.pathname.split("/").at(-1))) });
    });
    const store = createDraftBoardsStore();
    assert.equal(store.getSnapshot().loading, true);
    await store.load();
    assert.equal(store.getSnapshot().items.length, 8);
    assert.equal(store.getSnapshot().page, 1);
    assert.equal(store.getSnapshot().hasMore, true);
    assert.equal(store.getSnapshot().loading, false);
    assert.equal(store.getSnapshot().loadingFeatured, false);
    assert.deepEqual(calls, [
        "/api/v1/boards?scope=drafts&page=1",
        ...[1, 2, 3, 4, 5].map((id) => `/api/v1/boards/${id}`)
    ]);
    assert.deepEqual(
        Object.keys(store.getSnapshot().documents)
            .map(Number)
            .sort((a, b) => a - b),
        [1, 2, 3, 4, 5]
    );
    assert.deepEqual(store.getSnapshot().failedIds, []);
});

test("initial failures retain an honest empty collection and a subsequent load retries the real first page", async (t) => {
    const state = { unavailable: true };
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        requests.push(url.pathname + url.search);
        if (state.unavailable) return failure(401, "Sign in to view your drafts.");
        return url.pathname === "/api/v1/boards" ? list([summary(9)]) : Response.json({ data: document(9) });
    });
    const store = createDraftBoardsStore();
    await store.load();
    assert.equal(store.getSnapshot().loading, false);
    assert.match(store.getSnapshot().error, /Sign in to view your drafts/);
    assert.deepEqual(store.getSnapshot().items, []);
    assert.deepEqual(store.getSnapshot().documents, {});
    assert.equal(store.getSnapshot().hasMore, false);
    state.unavailable = false;
    await store.load();
    assert.deepEqual(
        store.getSnapshot().items.map((item) => item.boardId),
        [9]
    );
    assert.equal(store.getSnapshot().error, "");
    assert.deepEqual(requests, [
        "/api/v1/boards?scope=drafts&page=1",
        "/api/v1/boards?scope=drafts&page=1",
        "/api/v1/boards/9"
    ]);
});

test("unavailable featured documents retain all summaries and successful reads; retries request only failures", async (t) => {
    const availability = { two: false, four: false };
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        requests.push(url.pathname + url.search);
        if (url.pathname === "/api/v1/boards") return list([1, 2, 3, 4, 5, 6].map((id) => summary(id)));
        const id = Number(url.pathname.split("/").at(-1));
        if (id === 2 && !availability.two) return failure(403, "Draft unavailable.");
        if (id === 4 && !availability.four) return failure(404, "Draft no longer exists.");
        return Response.json({ data: document(id) });
    });
    const store = createDraftBoardsStore();
    await store.load();
    const first = store.getSnapshot().documents[1];
    assert.equal(store.getSnapshot().items.length, 6);
    assert.deepEqual(store.getSnapshot().failedIds, [2, 4]);
    assert.equal(store.getSnapshot().error, "");
    const failedView = renderToStaticMarkup(createElement(DraftBoardListContent, presenter(store)));
    assert.match(failedView, /Preview unavailable/);
    assert.match(failedView, />Retry previews<\/button>/);
    assert.match(failedView, /href="\/boards\/drafts\/2"/);
    assert.match(failedView, /href="\/boards\/drafts\/4"/);
    availability.two = true;
    await store.retryFeatured();
    assert.equal(store.getSnapshot().documents[1], first);
    assert.ok(store.getSnapshot().documents[2]);
    assert.deepEqual(store.getSnapshot().failedIds, [4]);
    availability.four = true;
    await store.retryFeatured();
    assert.deepEqual(store.getSnapshot().failedIds, []);
    assert.equal(store.getSnapshot().items.length, 6);
    assert.deepEqual(requests.slice(6), ["/api/v1/boards/2", "/api/v1/boards/4", "/api/v1/boards/4"]);
});

test("published or no-longer-editable documents never become featured draft previews", async (t) => {
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        if (url.pathname === "/api/v1/boards") return list([summary(1), summary(2), summary(3)]);
        const id = Number(url.pathname.split("/").at(-1));
        return Response.json({
            data:
                id === 1
                    ? { ...document(id), status: "published" }
                    : id === 2
                      ? { ...document(id), permissions: { canEditContent: false, canManageBoard: false } }
                      : document(id)
        });
    });
    const store = createDraftBoardsStore();
    await store.load();
    assert.deepEqual(store.getSnapshot().failedIds, [1, 2]);
    assert.deepEqual(Object.keys(store.getSnapshot().documents), ["3"]);
    assert.equal(store.getSnapshot().items.length, 3);
});

test("pagination failure retains summaries and documents, retries the same page, and de-duplicates overlapping results", async (t) => {
    const state = { failPageTwo: true };
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        requests.push(url.pathname + url.search);
        if (url.pathname !== "/api/v1/boards")
            return Response.json({ data: document(Number(url.pathname.split("/").at(-1))) });
        if (url.searchParams.get("page") === "1")
            return list(
                [1, 2, 3, 4, 5, 6, 7].map((id) => summary(id)),
                true
            );
        if (state.failPageTwo) return failure(503, "More drafts are temporarily unavailable.");
        return list([7, 8, 8, 9].map((id) => summary(id)));
    });
    const store = createDraftBoardsStore();
    await store.load();
    const firstDocument = store.getSnapshot().documents[1];
    await store.loadMore();
    assert.equal(store.getSnapshot().page, 1);
    assert.equal(store.getSnapshot().items.length, 7);
    assert.equal(store.getSnapshot().documents[1], firstDocument);
    assert.match(store.getSnapshot().error, /temporarily unavailable/);
    assert.equal(store.getSnapshot().loadingMore, false);
    state.failPageTwo = false;
    await store.loadMore();
    assert.equal(store.getSnapshot().page, 2);
    assert.deepEqual(
        store.getSnapshot().items.map((item) => item.boardId),
        [1, 2, 3, 4, 5, 6, 7, 8, 9]
    );
    assert.equal(store.getSnapshot().error, "");
    assert.equal(store.getSnapshot().hasMore, false);
    assert.deepEqual(requests.slice(6), ["/api/v1/boards?scope=drafts&page=2", "/api/v1/boards?scope=drafts&page=2"]);
    await store.loadMore();
    assert.equal(requests.length, 8);
});

test("a canceled stale initial request cannot replace a newer successful draft collection", async (t) => {
    const pending = deferred<Response>();
    const lists: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        if (url.pathname !== "/api/v1/boards")
            return Response.json({ data: document(Number(url.pathname.split("/").at(-1))) });
        lists.push(url.search);
        return lists.length === 1 ? pending.promise : list([summary(20)]);
    });
    const store = createDraftBoardsStore();
    const oldRequest = store.load();
    store.cancel();
    await store.load();
    pending.resolve(list([summary(10)]));
    await oldRequest;
    assert.deepEqual(
        store.getSnapshot().items.map((item) => item.boardId),
        [20]
    );
    assert.ok(store.getSnapshot().documents[20]);
    assert.equal(store.getSnapshot().documents[10], undefined);
    assert.equal(store.getSnapshot().loading, false);
});

test("concurrent pagination controls share one request and late canceled pages cannot append to a refreshed collection", async (t) => {
    const pending = deferred<Response>();
    const state = { refreshed: false };
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        requests.push(url.pathname + url.search);
        if (url.pathname !== "/api/v1/boards")
            return Response.json({ data: document(Number(url.pathname.split("/").at(-1))) });
        if (url.searchParams.get("page") === "2") return pending.promise;
        return list([summary(state.refreshed ? 30 : 1)], true);
    });
    const store = createDraftBoardsStore();
    await store.load();
    const nextPage = store.loadMore();
    await store.loadMore();
    assert.equal(requests.filter((path) => path.endsWith("page=2")).length, 1);
    store.cancel();
    state.refreshed = true;
    await store.load();
    pending.resolve(list([summary(2)]));
    await nextPage;
    assert.deepEqual(
        store.getSnapshot().items.map((item) => item.boardId),
        [30]
    );
    assert.equal(store.getSnapshot().page, 1);
    assert.equal(store.getSnapshot().loadingMore, false);
});

test("a short first page keeps its featured collection fixed when library pages add more drafts", async (t) => {
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        requests.push(url.pathname + url.search);
        if (url.pathname !== "/api/v1/boards")
            return Response.json({ data: document(Number(url.pathname.split("/").at(-1))) });
        return url.searchParams.get("page") === "1"
            ? list([summary(1), summary(2)], true)
            : list([summary(3), summary(4)]);
    });
    const store = createDraftBoardsStore();
    await store.load();
    await store.loadMore();
    assert.deepEqual(store.getSnapshot().featuredIds, [1, 2]);
    assert.deepEqual(
        store.getSnapshot().items.map((item) => item.boardId),
        [1, 2, 3, 4]
    );
    assert.deepEqual(requests, [
        "/api/v1/boards?scope=drafts&page=1",
        "/api/v1/boards/1",
        "/api/v1/boards/2",
        "/api/v1/boards?scope=drafts&page=2"
    ]);
    const markup = renderToStaticMarkup(createElement(DraftBoardListContent, presenter(store)));
    assert.match(markup, /aria-label="Edit draft: Draft journey 3"/);
    assert.doesNotMatch(markup, /aria-label="Edit recent draft: Draft journey 3"/);
});

test("summaries become usable while featured reads are pending, and cancellation rejects late documents", async (t) => {
    const started = deferred<void>();
    const pending = deferred<Response>();
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        if (url.pathname === "/api/v1/boards") return list([summary(42)]);
        started.resolve();
        return pending.promise;
    });
    const store = createDraftBoardsStore();
    const request = store.load();
    await started.promise;
    assert.deepEqual(
        store.getSnapshot().items.map((item) => item.boardId),
        [42]
    );
    assert.equal(store.getSnapshot().loading, false);
    assert.equal(store.getSnapshot().loadingFeatured, true);
    store.cancel();
    const canceled = store.getSnapshot();
    pending.resolve(Response.json({ data: document(42) }));
    await request;
    assert.equal(store.getSnapshot(), canceled);
    assert.equal(store.getSnapshot().documents[42], undefined);
});

test("title search filters only loaded summaries and leaves the source collection intact", () => {
    const items = [summary(1, "Slow Kyoto journal"), summary(2, "Oslo walks"), summary(3, "Kyoto food stops")];
    const before = structuredClone(items);
    assert.deepEqual(
        filterDraftBoards(items, "  kYoTo  ").map((item) => item.boardId),
        [1, 3]
    );
    assert.deepEqual(
        filterDraftBoards(items, "").map((item) => item.boardId),
        [1, 2, 3]
    );
    assert.deepEqual(filterDraftBoards(items, "unloaded place"), []);
    assert.deepEqual(items, before);
});

function presenter(
    store: ReturnType<typeof createDraftBoardsStore>,
    query = "",
    onQueryChange: (value: string) => void = () => {}
) {
    return {
        state: store.getSnapshot(),
        query,
        onQueryChange,
        onRetry: () => store.load(),
        onLoadMore: () => store.loadMore(),
        onRetryFeatured: () => store.retryFeatured()
    };
}

test("draft browser represents loading, auth failure and an empty account without fake Boards", async (t) => {
    const state = { fail: true };
    t.mock.method(globalThis, "fetch", async () =>
        state.fail ? failure(401, "Sign in to continue your drafts.") : list([])
    );
    const store = createDraftBoardsStore();
    const loading = renderToStaticMarkup(createElement(DraftBoardListContent, presenter(store)));
    assert.match(loading, /role="status"|aria-busy="true"/);
    await store.load();
    const error = renderToStaticMarkup(createElement(DraftBoardListContent, presenter(store)));
    assert.match(error, /role="alert"/);
    assert.match(error, /Sign in to continue your drafts\./);
    assert.doesNotMatch(error, /href="\/boards\/drafts\/\d+"|Sample collection/i);
    assert.match(error, />Try again<\/button>/);
    state.fail = false;
    await store.load();
    const empty = renderToStaticMarkup(createElement(DraftBoardListContent, presenter(store)));
    assert.doesNotMatch(empty, /href="\/boards\/drafts\/\d+"|Sample collection/i);
    assert.match(empty, /No drafts|No saved drafts|Your archive is empty/i);
    assert.match(empty, /href="\/boards\/new"|href="\/create"/);
});

test("draft selection renders honest featured cards and summary tiles, with all edit links reopening drafts", async (t) => {
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        return url.pathname === "/api/v1/boards"
            ? list([1, 2, 3, 4, 5, 6].map((id) => summary(id)))
            : Response.json({ data: document(Number(url.pathname.split("/").at(-1))) });
    });
    const store = createDraftBoardsStore();
    await store.load();
    const markup = renderToStaticMarkup(createElement(DraftBoardListContent, presenter(store)));
    for (const id of [1, 2, 3, 4, 5, 6]) assert.ok(markup.includes(`href="/boards/drafts/${id}"`));
    assert.doesNotMatch(markup, /href="\/boards\/[1-6]"/);
    assert.match(markup, /Draft journey 6/);
    assert.match(markup, /variant=thumbnail/);
    assert.doesNotMatch(
        markup.replace(/<[^>]*>/g, ""),
        /Highlights:|Saved by|by Roamboard|sample collection|editorial sample/i
    );
});

test("a controlled search query filters library tiles without changing the featured collection", async (t) => {
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        if (url.pathname !== "/api/v1/boards")
            return Response.json({ data: document(Number(url.pathname.split("/").at(-1))) });
        return list([
            ...Array.from({ length: 5 }, (_, index) => summary(index + 1)),
            summary(6, "Oslo library journey")
        ]);
    });
    const store = createDraftBoardsStore();
    await store.load();
    const filtered = renderToStaticMarkup(createElement(DraftBoardListContent, presenter(store, "Draft journey 1")));
    assert.match(filtered, /<input[^>]*type="search"[^>]*value="Draft journey 1"/);
    assert.doesNotMatch(filtered, /Oslo library journey/);
    assert.match(filtered, /Draft journey 2/);
    assert.match(filtered, /href="\/boards\/drafts\/1"/);
});

test("reopening and updating a selected draft preserves its revision and child IDs through the existing API helpers", async (t) => {
    const requests: Array<{ path: string; method: string; body?: Record<string, unknown> }> = [];
    t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
        assert.equal(init.credentials, "include");
        requests.push({
            path: new URL(input).pathname,
            method: init.method ?? "GET",
            body: init.body ? JSON.parse(String(init.body)) : undefined
        });
        return Response.json({ data: { ...document(42), revision: init.method === "PUT" ? 9 : 8 } });
    });
    const selected = await loadBoardDocument(42);
    const restored = fromBoardDocument(selected);
    const write = toBoardWrite(
        {
            title: "Updated draft title",
            description: selected.description ?? "",
            status: "draft",
            visibility: selected.visibility,
            coverImageId: selected.coverImageId,
            tags: selected.tags.map((tag) => tag.name),
            ...restored
        },
        selected.tags
    );
    await saveBoardDocument(write, selected);
    assert.deepEqual(
        requests.map((request) => [request.path, request.method]),
        [
            ["/api/v1/boards/42", "GET"],
            ["/api/v1/boards/42", "PUT"]
        ]
    );
    assert.equal(requests[1].body?.revision, 8);
    assert.equal(write.days[0].dayId, 420);
    assert.equal(write.days[0].activities[0].activityId, 4200);
    assert.deepEqual(write.days[0].activities[0].uploadedImageIds, [42]);
    assert.equal(write.coverImageId, 42);
    assert.equal(write.title, "Updated draft title");
});
