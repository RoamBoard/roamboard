import assert from "node:assert/strict";
import test from "node:test";
import { createBoardSaveStore } from "../src/lib/board-save-store";

function deferredResponse() {
    const state: { resolve?: (response: Response) => void } = {};
    const promise = new Promise<Response>((resolve) => {
        state.resolve = resolve;
    });
    return {
        promise,
        resolve(response: Response) {
            assert.ok(state.resolve);
            state.resolve(response);
        }
    };
}

test("account saving uses the real credentialed API clients and waits for confirmed persistence", async (t) => {
    const pending = deferredResponse();
    const requests: Array<{ path: string; method: string }> = [];
    t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
        requests.push({ path: new URL(input).pathname, method: init.method! });
        assert.equal(init.credentials, "include");
        assert.equal(init.cache, "no-store");
        return init.method === "PUT" ? pending.promise : new Response(null, { status: 204 });
    });
    const store = createBoardSaveStore(91, false);
    const observed: Array<{ saved: boolean | undefined; pending: boolean }> = [];
    const unsubscribe = store.subscribe(() => {
        const { saved, pending } = store.getSnapshot();
        observed.push({ saved, pending });
    });
    const save = store.toggle();
    assert.equal(store.getSnapshot().saved, false, "Pending saves must not claim persisted success");
    assert.equal(store.getSnapshot().pending, true);
    assert.equal(store.getSnapshot().message, "");
    await store.toggle();
    assert.equal(requests.length, 1, "Repeated presses during the request must not create another mutation");
    pending.resolve(Response.json({ data: { boardId: 91, saved: true } }, { status: 201 }));
    await save;
    assert.equal(store.getSnapshot().saved, true);
    assert.equal(store.getSnapshot().pending, false);
    assert.ok(store.getSnapshot().message);
    assert.equal(store.getSnapshot().error, "");
    await store.toggle();
    assert.equal(store.getSnapshot().saved, false);
    assert.equal(store.getSnapshot().pending, false);
    assert.deepEqual(requests, [
        { path: "/api/v1/boards/91/save", method: "PUT" },
        { path: "/api/v1/boards/91/save", method: "DELETE" }
    ]);
    assert.ok(observed.some(({ saved, pending }) => saved === false && pending));
    assert.ok(observed.some(({ saved, pending }) => saved === true && !pending));
    unsubscribe();
});

test("failed save and unsave requests retain the previously confirmed state and can be retried", async (t) => {
    const response = { fail: true };
    t.mock.method(globalThis, "fetch", async (_input: string, init: RequestInit) => {
        if (response.fail)
            return Response.json({ error: { code: "FORBIDDEN", message: "Board access changed." } }, { status: 403 });
        return init.method === "DELETE"
            ? new Response(null, { status: 204 })
            : Response.json({ data: { boardId: 92, saved: true } });
    });
    for (const initialSaved of [false, true]) {
        response.fail = true;
        const store = createBoardSaveStore(92, initialSaved);
        await store.toggle();
        assert.equal(store.getSnapshot().saved, initialSaved);
        assert.equal(store.getSnapshot().pending, false);
        assert.equal(store.getSnapshot().message, "");
        assert.match(store.getSnapshot().error, /Board access changed/);
        response.fail = false;
        await store.toggle();
        assert.equal(store.getSnapshot().saved, !initialSaved);
        assert.equal(store.getSnapshot().error, "");
        assert.ok(store.getSnapshot().message);
    }
});

test("network failures and malformed save acknowledgements never produce saved success", async (t) => {
    const responses = [
        () => Promise.reject(new Error("Offline")),
        () => Promise.resolve(Response.json({ data: { boardId: 93, saved: false } })),
        () => Promise.resolve(Response.json({ data: { boardId: 999, saved: true } })),
        () => Promise.resolve(Response.json({ data: {} })),
        () => Promise.resolve(new Response("Backend proxy error", { status: 502 }))
    ];
    for (const response of responses) {
        t.mock.method(globalThis, "fetch", response);
        const store = createBoardSaveStore(93, false);
        await store.toggle();
        assert.equal(store.getSnapshot().saved, false);
        assert.equal(store.getSnapshot().pending, false);
        assert.equal(store.getSnapshot().message, "");
        assert.ok(store.getSnapshot().error);
        t.mock.restoreAll();
    }
});

test("expired sessions expose a sign-in requirement without changing bookmark state", async (t) => {
    t.mock.method(globalThis, "fetch", async () =>
        Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in to save this Board." } }, { status: 401 })
    );
    const store = createBoardSaveStore(94, false);
    await store.toggle();
    assert.equal(store.getSnapshot().signInRequired, true);
    assert.equal(store.getSnapshot().saved, false);
    assert.equal(store.getSnapshot().pending, false);
    assert.equal(store.getSnapshot().message, "");
});

test("unknown initial saved membership never assumes unsaved or sends a mutation", async (t) => {
    const fetch = t.mock.method(globalThis, "fetch", async () => {
        throw new Error("Unknown membership should not request a toggle");
    });
    const store = createBoardSaveStore(95, undefined);
    assert.equal(store.getSnapshot().saved, undefined);
    await store.toggle();
    assert.equal(store.getSnapshot().saved, undefined);
    assert.equal(store.getSnapshot().pending, false);
    assert.equal(store.getSnapshot().message, "");
    assert.equal(fetch.mock.callCount(), 0);
});

test("unsaving retains saved state while pending and suppresses duplicate removal requests", async (t) => {
    const pending = deferredResponse();
    const fetch = t.mock.method(globalThis, "fetch", async (_input: string, init: RequestInit) => {
        assert.equal(init.method, "DELETE");
        return pending.promise;
    });
    const store = createBoardSaveStore(96, true);
    const removing = store.toggle();
    assert.equal(store.getSnapshot().saved, true);
    assert.equal(store.getSnapshot().pending, true);
    assert.equal(store.getSnapshot().message, "");
    await store.toggle();
    assert.equal(fetch.mock.callCount(), 1);
    pending.resolve(new Response(null, { status: 204 }));
    await removing;
    assert.equal(store.getSnapshot().saved, false);
    assert.equal(store.getSnapshot().pending, false);
});

test("successful retry after sign-in clears the stale authentication error and sign-in requirement", async (t) => {
    const session = { expired: true };
    t.mock.method(globalThis, "fetch", async () =>
        session.expired
            ? Response.json({ error: { code: "UNAUTHORIZED", message: "Session expired." } }, { status: 401 })
            : Response.json({ data: { boardId: 97, saved: true } })
    );
    const store = createBoardSaveStore(97, false);
    await store.toggle();
    assert.equal(store.getSnapshot().signInRequired, true);
    assert.equal(store.getSnapshot().saved, false);
    session.expired = false;
    await store.toggle();
    assert.equal(store.getSnapshot().saved, true);
    assert.equal(store.getSnapshot().signInRequired, false);
    assert.equal(store.getSnapshot().error, "");
    assert.ok(store.getSnapshot().message);
});
