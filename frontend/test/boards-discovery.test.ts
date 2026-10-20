import assert from "node:assert/strict";
import test from "node:test";
import {
    boardsSearchHref,
    createDiscoveryStore,
    discoveryRequest,
    discoverySelection,
    type DiscoveryCard
} from "../src/lib/boards-discovery";
import { trackBoardView } from "../src/lib/board-view-tracking";

const card = (boardId: number): DiscoveryCard => ({
    boardId,
    title: "Stockholm weekend",
    description: "Cafés",
    status: "published",
    visibility: "public",
    owner: { username: "reader", displayName: "Reader", photoUrl: null },
    destination: { name: "Stockholm", city: "Stockholm", country: "SWE", address: null },
    coverImageUrl: null,
    tags: ["food"],
    durationDays: 2,
    activityCount: 3,
    savedCount: 4,
    savedByMe: true,
    firstPublishedAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-02T00:00:00Z",
    permissions: { canEditContent: false, canManageBoard: false }
});
const result = (items: DiscoveryCard[], page = 1) => ({
    data: { items, page, limit: 10, total: 30, hasMore: page < 3 }
});

test("search links retain query, numbered page and removed location interpretation", () => {
    const url = new URL(boardsSearchHref("  Reading cafés & food  ", 3, "off"), "https://example.test");
    assert.equal(url.pathname, "/boards");
    assert.equal(url.searchParams.get("q"), "Reading cafés & food");
    assert.equal(url.searchParams.get("page"), "3");
    assert.equal(url.searchParams.get("location"), "off");
});

test("discovery requests include session credentials and preserve API failures", async (context) => {
    const calls: { url: string; init?: RequestInit }[] = [];
    context.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return Response.json({ error: { message: "Access changed" } }, { status: 404 });
    });
    await assert.rejects(discoveryRequest("/boards/recent"), /Access changed/);
    assert.match(calls[0].url, /\/api\/v1\/boards\/recent$/);
    assert.equal(calls[0].init?.credentials, "include");
    assert.equal(calls[0].init?.cache, "no-store");
});

test("late search results cannot replace newer suggestions or restore cleared results", async (context) => {
    const pending = new Map<string, (response: Response) => void>();
    context.mock.method(
        globalThis,
        "fetch",
        (url: string) => new Promise<Response>((resolve) => pending.set(url.split("/api/v1")[1], resolve))
    );
    const store = createDiscoveryStore();
    const older = store.load("/boards/search/suggestions?q=Stockholm");
    const newer = store.load("/boards/search/suggestions?q=Paris");
    pending.get("/boards/search/suggestions?q=Paris")!(Response.json(result([card(2)])));
    await newer;
    pending.get("/boards/search/suggestions?q=Stockholm")!(Response.json(result([card(1)])));
    await older;
    assert.deepEqual(
        store.getSnapshot().data?.items.map((item) => item.boardId),
        [2]
    );
    const cancelled = store.load("/boards/search/suggestions?q=Reading");
    store.cancel();
    pending.get("/boards/search/suggestions?q=Reading")!(Response.json(result([card(3)])));
    await cancelled;
    assert.equal(store.getSnapshot().data, null);
});

test("failed Load more preserves cards and a retry appends without duplicate cards", async (context) => {
    const responses = [
        Response.json(result([card(1), card(2)])),
        Response.json({ error: { message: "Try again" } }, { status: 503 }),
        Response.json(result([card(2), card(3)], 2))
    ];
    context.mock.method(globalThis, "fetch", async () => responses.shift()!);
    const store = createDiscoveryStore();
    await store.load("/boards/recent?page=1");
    await store.load("/boards/recent?page=2", true);
    assert.deepEqual(
        store.getSnapshot().data?.items.map((item) => item.boardId),
        [1, 2]
    );
    assert.match(store.getSnapshot().error, /Try again/);
    await store.load("/boards/recent?page=2", true);
    assert.deepEqual(
        store.getSnapshot().data?.items.map((item) => item.boardId),
        [1, 2, 3]
    );
    assert.equal(store.getSnapshot().data?.page, 2);
});

test("gallery adaptation preserves draft status, edit permissions and saved ordering timestamp", () => {
    const draft = discoverySelection(
        { ...card(1), status: "draft", permissions: { canEditContent: true, canManageBoard: true } },
        "owned"
    );
    assert.equal(draft.photo.status, "draft");
    assert.equal(draft.editHref, "/boards/drafts/1");
    const published = discoverySelection(
        { ...card(2), permissions: { canEditContent: true, canManageBoard: true } },
        "owned"
    );
    assert.equal(published.editHref, "/boards/2/edit");
    assert.equal(discoverySelection(card(3)).editHref, undefined);
    const savedAt = "2026-10-20T00:00:00Z";
    assert.equal(discoverySelection({ ...card(4), savedAt }, "saved").summary.updatedAt, savedAt);
    assert.equal(draft.previewResolved, true);
});

test("board views require three continuous visible seconds and stop after unmount", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const events = new EventTarget();
    const visibility = Object.assign(events, { visibilityState: "visible" });
    const bodies: string[] = [];
    context.mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
        bodies.push(String(init?.body));
        return Response.json({ data: { token: "challenge", counted: false } });
    });
    const flush = async () => {
        await new Promise<void>((resolve) => setImmediate(resolve));
    };
    const stop = trackBoardView(42, visibility as unknown as Document);
    await flush();
    context.mock.timers.tick(2999);
    assert.deepEqual(bodies, ["{}"]);
    visibility.visibilityState = "hidden";
    events.dispatchEvent(new Event("visibilitychange"));
    context.mock.timers.tick(3000);
    assert.deepEqual(bodies, ["{}"]);
    visibility.visibilityState = "visible";
    events.dispatchEvent(new Event("visibilitychange"));
    await flush();
    context.mock.timers.tick(2999);
    assert.deepEqual(bodies, ["{}", "{}"]);
    context.mock.timers.tick(1);
    await flush();
    assert.deepEqual(bodies, ["{}", "{}", JSON.stringify({ token: "challenge" })]);
    stop();
    events.dispatchEvent(new Event("visibilitychange"));
    context.mock.timers.tick(10000);
    assert.equal(bodies.length, 3);
});

test("unmount while a view challenge is pending prevents later confirmation", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const visibility = Object.assign(new EventTarget(), { visibilityState: "visible" });
    const pending: { resolve?: (response: Response) => void; count: number } = { count: 0 };
    context.mock.method(globalThis, "fetch", () => {
        pending.count++;
        return new Promise<Response>((resolve) => {
            pending.resolve = resolve;
        });
    });
    const stop = trackBoardView(42, visibility as unknown as Document);
    stop();
    pending.resolve!(Response.json({ data: { token: "late-challenge" } }));
    await new Promise<void>((resolve) => setImmediate(resolve));
    context.mock.timers.tick(5000);
    assert.equal(pending.count, 1);
});

test("confirmed unsave invalidates pending offsets and retains remaining cards until page-one retry succeeds", async (context) => {
    const pending = new Map<string, (response: Response) => void>();
    context.mock.method(
        globalThis,
        "fetch",
        (url: string) =>
            new Promise<Response>((resolve) => {
                pending.set(url.split("/api/v1")[1], resolve);
            })
    );
    const store = createDiscoveryStore();
    const first = store.load("/boards/saved?page=1");
    pending.get("/boards/saved?page=1")!(Response.json(result([card(1), card(2)])));
    await first;
    const oldOffset = store.load("/boards/saved?page=2", true);
    store.removeConfirmed(1);
    assert.deepEqual(
        store.getSnapshot().data?.items.map((item) => item.boardId),
        [2]
    );
    assert.equal(
        store.getSnapshot().data?.hasMore,
        false,
        "offset pagination must stay unavailable until the refreshed first page is known"
    );
    pending.get("/boards/saved?page=2")!(Response.json(result([card(1), card(3)], 2)));
    await oldOffset;
    assert.deepEqual(
        store.getSnapshot().data?.items.map((item) => item.boardId),
        [2]
    );
    const failedRefresh = store.load("/boards/saved?page=1", false, true);
    pending.get("/boards/saved?page=1")!(Response.json({ error: { message: "Refresh unavailable" } }, { status: 503 }));
    await failedRefresh;
    assert.deepEqual(
        store.getSnapshot().data?.items.map((item) => item.boardId),
        [2]
    );
    assert.equal(store.getSnapshot().data?.hasMore, false);
    assert.match(store.getSnapshot().error, /Refresh unavailable/);
    const retry = store.load("/boards/saved?page=1", false, true);
    pending.get("/boards/saved?page=1")!(Response.json(result([card(3), card(4)])));
    await retry;
    assert.deepEqual(
        store.getSnapshot().data?.items.map((item) => item.boardId),
        [3, 4],
        "page one replaces retained cards instead of appending them"
    );
    assert.equal(store.getSnapshot().data?.page, 1);
    assert.equal(store.getSnapshot().data?.hasMore, true);
});
