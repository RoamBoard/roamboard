import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SavedBoardGrid from "../src/components/features/boards/SavedBoardGrid";
import AccountPhotoBoardCard from "../src/components/features/boards/cards/AccountPhotoBoardCard";
import { createBoardSaveStore, toggleBoardSave } from "../src/lib/board-save-store";
import { toSavedPhotoBoardCard } from "../src/lib/photo-board-card";
import { createSavedBoardsStore, type SavedBoardsState } from "../src/lib/saved-boards-store";
import type { SavedBoardSummary } from "../src/lib/profile";

function summary(boardId: number): SavedBoardSummary {
    return {
        boardId,
        title: `Saved journey ${boardId}`,
        description: `Real description ${boardId}`,
        owner: { id: `author-${boardId}`, username: `full_author_${boardId}`, displayName: `Author ${boardId}` },
        coverImageUrl: boardId === 41 ? "/api/v1/boards/41/images/8/content" : null,
        savedAt: "2026-10-16T11:00:00.000Z"
    };
}

function page(ids: number[], hasMore = false) {
    return Response.json({ data: ids.map(summary), meta: { page: 1, limit: 2, hasMore } });
}

function deferred() {
    const state: { resolve?: (response: Response) => void } = {};
    return {
        promise: new Promise<Response>((resolve) => {
            state.resolve = resolve;
        }),
        resolve(response: Response) {
            assert.ok(state.resolve);
            state.resolve(response);
        }
    };
}

function settled(store: ReturnType<typeof createSavedBoardsStore>, matches: (state: SavedBoardsState) => boolean) {
    return new Promise<void>((resolve) => {
        const unsubscribe = store.subscribe(() => {
            if (matches(store.getSnapshot())) {
                unsubscribe();
                resolve();
            }
        });
    });
}

test("saved summaries use genuine metadata and filled V4 bookmarks without document or account reads", (t) => {
    const fetch = t.mock.method(globalThis, "fetch", async () => {
        throw new Error("No card metadata requests");
    });
    const first = summary(41);
    const data = toSavedPhotoBoardCard(first);
    assert.equal(data.id, "41");
    assert.equal(data.author, "full_author_41");
    assert.equal(data.description, first.description);
    assert.equal(data.status, "published");
    assert.equal(
        data.image?.src,
        new URL(first.coverImageUrl!, process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").toString()
    );
    assert.equal(data.destination, "");
    assert.equal(data.destinationLabel, "");
    for (const key of ["visibility", "tags", "durationDays", "savedCount"] as const) assert.equal(data[key], undefined);
    const markup = renderToStaticMarkup(createElement(SavedBoardGrid, { boards: [first, summary(42)], onUnsave() {} }));
    assert.equal((markup.match(/aspect-ratio:400 \/ 500/g) ?? []).length, 2);
    assert.equal((markup.match(/aria-pressed="true"/g) ?? []).length, 2);
    assert.match(markup, /aria-label="Unsave Saved journey 41"/);
    assert.match(markup, /href="\/boards\/41"/);
    assert.match(markup, /href="\/boards\/42"/);
    assert.match(markup, /full_author_41/);
    assert.match(markup, /No cover photo/);
    assert.doesNotMatch(markup, /href="[^\"]*\/edit|0 saves|0 days|aria-label="(?:Public|Friends|Restricted access)/);
    assert.equal(fetch.mock.callCount(), 0);
});

test("account wrapper keeps unknown membership disabled and never guesses ownership from a numeric ID", () => {
    const board = toSavedPhotoBoardCard(summary(41));
    const unknownSave = renderToStaticMarkup(createElement(AccountPhotoBoardCard, { board, ownership: "other" }));
    assert.match(unknownSave, /<button[^>]*disabled=""[^>]*aria-label="Save status unavailable for Saved journey 41"/);
    assert.doesNotMatch(unknownSave, /aria-pressed=/);
    for (const props of [
        { board, ownership: "unknown" as const, initialSaved: true },
        { board: { ...board, id: "sample-41" }, ownership: "other" as const, initialSaved: true },
        { board: { ...board, id: "0" }, ownership: "other" as const, initialSaved: true }
    ]) {
        const markup = renderToStaticMarkup(createElement(AccountPhotoBoardCard, props));
        assert.doesNotMatch(
            markup,
            /aria-pressed=|aria-label="(?:Save |Unsave |Save status unavailable|Public —|Friends —|Restricted access —)/
        );
    }
});

test(
    "confirmed unsave alone removes a row, suppresses repeated presses, and restarts shifted pagination",
    { timeout: 3000 },
    async (t) => {
        const deletion = deferred();
        const refresh = deferred();
        const requests: string[] = [];
        t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
            const url = new URL(input);
            assert.equal(init.credentials, "include");
            assert.equal(init.cache, "no-store");
            requests.push(`${init.method ?? "GET"} ${url.pathname}${url.search}`);
            if (init.method === "DELETE") return deletion.promise;
            return requests.length === 1 ? page([41, 42], true) : refresh.promise;
        });
        const collection = createSavedBoardsStore(2);
        assert.equal(collection.getSnapshot().loaded, false);
        await collection.loadFirst();
        const bookmark = createBoardSaveStore(41, true);
        const changes: boolean[] = [];
        const remove = (saved: boolean) => {
            changes.push(saved);
            if (!saved) collection.removeConfirmed(41);
        };
        const pending = toggleBoardSave(bookmark, remove);
        await toggleBoardSave(bookmark, remove);
        assert.deepEqual(
            collection.getSnapshot().items.map((board) => board.boardId),
            [41, 42]
        );
        assert.deepEqual(changes, []);
        assert.equal(requests.length, 2);
        deletion.resolve(new Response(null, { status: 204 }));
        await pending;
        assert.deepEqual(changes, [false]);
        assert.deepEqual(
            collection.getSnapshot().items.map((board) => board.boardId),
            [42]
        );
        assert.equal(collection.getSnapshot().hasMore, false);
        const refreshed = settled(collection, (state) => !state.loading);
        refresh.resolve(page([42, 43], true));
        await refreshed;
        assert.deepEqual(
            collection.getSnapshot().items.map((board) => board.boardId),
            [42, 43]
        );
        assert.deepEqual(requests, [
            "GET /api/v1/users/me/saved-boards?page=1&limit=2",
            "DELETE /api/v1/boards/41/save",
            "GET /api/v1/users/me/saved-boards?page=1&limit=2"
        ]);
    }
);

test("failed unsave and unknown membership never notify a collection of a successful removal", async (t) => {
    const fetch = t.mock.method(globalThis, "fetch", async () =>
        Response.json({ error: { code: "UNAUTHENTICATED", message: "Sign in again." } }, { status: 401 })
    );
    const changes: boolean[] = [];
    const bookmark = createBoardSaveStore(41, true);
    await toggleBoardSave(bookmark, (saved) => changes.push(saved));
    assert.equal(bookmark.getSnapshot().saved, true);
    assert.equal(bookmark.getSnapshot().signInRequired, true);
    assert.equal(changes.length, 0);
    await toggleBoardSave(createBoardSaveStore(42, undefined), (saved) => changes.push(saved));
    assert.equal(changes.length, 0);
    assert.equal(fetch.mock.callCount(), 1);
});

test("empty saved lists complete once, while duplicate initial reads share the pending load", async (t) => {
    const response = deferred();
    const fetch = t.mock.method(globalThis, "fetch", async () => response.promise);
    const store = createSavedBoardsStore();
    const pending = store.loadFirst();
    await store.loadFirst();
    assert.equal(store.getSnapshot().loading, true);
    assert.equal(store.getSnapshot().loaded, false);
    assert.equal(fetch.mock.callCount(), 1);
    response.resolve(page([]));
    await pending;
    assert.equal(store.getSnapshot().loaded, true);
    assert.equal(store.getSnapshot().loading, false);
    assert.deepEqual(store.getSnapshot().items, []);
    assert.equal(store.getSnapshot().error, "");
    assert.equal(store.getSnapshot().hasMore, false);
    await store.loadFirst();
    await store.loadMore();
    store.removeConfirmed(999);
    assert.equal(fetch.mock.callCount(), 1);
});

test(
    "failed post-removal refresh retains other cards and retries page one before exposing more",
    { timeout: 3000 },
    async (t) => {
        const requests: string[] = [];
        const refresh = deferred();
        t.mock.method(globalThis, "fetch", async (input: string) => {
            requests.push(new URL(input).search);
            if (requests.length === 1) return page([41, 42], true);
            if (requests.length === 2) return refresh.promise;
            return page([42, 43], true);
        });
        const store = createSavedBoardsStore(2);
        await store.loadFirst();
        store.removeConfirmed(41);
        const failed = settled(store, (state) => !state.loading && Boolean(state.error));
        refresh.resolve(
            Response.json({ error: { code: "UNAVAILABLE", message: "Reload unavailable." } }, { status: 503 })
        );
        await failed;
        assert.deepEqual(
            store.getSnapshot().items.map((board) => board.boardId),
            [42]
        );
        assert.equal(store.getSnapshot().hasMore, false);
        assert.match(store.getSnapshot().error, /Reload unavailable/);
        await store.loadMore();
        assert.equal(requests.length, 2);
        await store.retry();
        assert.deepEqual(
            store.getSnapshot().items.map((board) => board.boardId),
            [42, 43]
        );
        assert.equal(store.getSnapshot().error, "");
        assert.equal(store.getSnapshot().hasMore, true);
        assert.deepEqual(requests, Array(3).fill("?page=1&limit=2"));
    }
);

test(
    "a pending old offset page cannot resurrect an unsaved card or skip the refreshed first page",
    { timeout: 3000 },
    async (t) => {
        const oldPage = deferred();
        const refresh = deferred();
        const requests: string[] = [];
        t.mock.method(globalThis, "fetch", async (input: string) => {
            requests.push(new URL(input).search);
            if (requests.length === 1) return page([41, 42], true);
            return requests.length === 2 ? oldPage.promise : refresh.promise;
        });
        const store = createSavedBoardsStore(2);
        await store.loadFirst();
        const loading = store.loadMore();
        await store.loadMore();
        store.removeConfirmed(41);
        oldPage.resolve(page([41, 43], true));
        await loading;
        assert.deepEqual(
            store.getSnapshot().items.map((board) => board.boardId),
            [42]
        );
        assert.equal(store.getSnapshot().loading, true);
        const refreshed = settled(store, (state) => !state.loading);
        refresh.resolve(page([42, 43], true));
        await refreshed;
        assert.deepEqual(
            store.getSnapshot().items.map((board) => board.boardId),
            [42, 43]
        );
        assert.deepEqual(requests, ["?page=1&limit=2", "?page=2&limit=2", "?page=1&limit=2"]);
    }
);

test("saved-list pagination deduplicates overlap, retries the failed page, and clears protected rows on 401", async (t) => {
    const requests: string[] = [];
    const responses = [
        page([41, 42], true),
        Response.json({ error: { code: "UNAVAILABLE", message: "More unavailable." } }, { status: 503 }),
        page([42, 43], true),
        Response.json({ error: { code: "UNAUTHENTICATED", message: "Sign in again." } }, { status: 401 })
    ];
    t.mock.method(globalThis, "fetch", async (input: string) => {
        requests.push(new URL(input).search);
        return responses[requests.length - 1];
    });
    const store = createSavedBoardsStore(2);
    await store.loadFirst();
    await store.loadMore();
    assert.deepEqual(
        store.getSnapshot().items.map((board) => board.boardId),
        [41, 42]
    );
    assert.match(store.getSnapshot().error, /More unavailable/);
    await store.retry();
    assert.deepEqual(
        store.getSnapshot().items.map((board) => board.boardId),
        [41, 42, 43]
    );
    await store.loadMore();
    assert.equal(store.getSnapshot().signInRequired, true);
    assert.deepEqual(store.getSnapshot().items, []);
    assert.equal(store.getSnapshot().hasMore, false);
    assert.deepEqual(requests, ["?page=1&limit=2", "?page=2&limit=2", "?page=2&limit=2", "?page=3&limit=2"]);
});
