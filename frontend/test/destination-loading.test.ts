import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DestinationLoading from "../src/components/features/destinations/DestinationLoading";
import { createDestinationLoadingStore } from "../src/lib/destination-loading";

const kyoto = "/discover/destinations/kyoto";
const paris = "/discover/destinations/paris";

function deferred<T>() {
    const pending: { resolve?: (value: T) => void; reject?: (reason: unknown) => void } = {};
    const promise = new Promise<T>((resolve, reject) => {
        Object.assign(pending, { resolve, reject });
    });
    return {
        promise,
        resolve: (value: T) => pending.resolve!(value),
        reject: (reason: unknown) => pending.reject!(reason)
    };
}

function fixture(context: TestContext, introMs = 3000, timeoutMs = 15000) {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const store = createDestinationLoadingStore({ introMs, timeoutMs });
    context.after(() => store.dispose());
    return store;
}

async function settle() {
    await new Promise<void>((resolve) => setImmediate(resolve));
}

test("fast destination navigation starts immediately but the full introduction finishes before reveal", async (context) => {
    const store = fixture(context);
    assert.equal(store.getSnapshot(), null);
    assert.equal(await store.begin("Kyoto", async () => kyoto), kyoto);
    assert.equal(store.getSnapshot()?.href, kyoto);
    assert.equal(store.getSnapshot()?.name, "Kyoto");
    store.ready(kyoto);
    assert.equal(store.getSnapshot()?.pageReady, true);
    assert.equal(store.getSnapshot()?.phase, "loading");
    context.mock.timers.tick(2999);
    assert.equal(store.getSnapshot()?.introComplete, false);
    assert.equal(store.getSnapshot()?.phase, "loading");
    context.mock.timers.tick(1);
    assert.equal(store.getSnapshot()?.introComplete, true);
    assert.equal(store.getSnapshot()?.phase, "revealing");
});

test("destination data loading and introduction run independently when data resolves during the sequence", async (context) => {
    const store = fixture(context);
    const route = deferred<string>();
    const navigation = store.begin("Paris", () => route.promise);
    context.mock.timers.tick(1000);
    route.resolve(paris);
    assert.equal(await navigation, paris);
    store.ready(paris);
    context.mock.timers.tick(1999);
    assert.equal(store.getSnapshot()?.phase, "loading");
    context.mock.timers.tick(1);
    assert.equal(store.getSnapshot()?.phase, "revealing");
});

test("slow loading keeps the completed introduction and reveals as soon as the route becomes ready", async (context) => {
    const store = fixture(context);
    const route = deferred<string>();
    const navigation = store.begin("Kyoto", () => route.promise);
    const attempt = store.getSnapshot()?.id;
    context.mock.timers.tick(7000);
    assert.equal(store.getSnapshot()?.introComplete, true);
    assert.equal(store.getSnapshot()?.pageReady, false);
    assert.equal(store.getSnapshot()?.phase, "loading");
    route.resolve(kyoto);
    assert.equal(await navigation, kyoto);
    assert.equal(store.getSnapshot()?.phase, "loading", "resolving a URL does not mean the page is ready");
    store.ready(kyoto);
    assert.equal(store.getSnapshot()?.phase, "revealing");
    assert.equal(store.getSnapshot()?.id, attempt, "slow loading must not restart the introduction");
});

test("an unknown destination URL uses the same real route-readiness contract", async (context) => {
    const store = fixture(context);
    const unknown = "/discover/destinations/unlisted-destination";
    assert.equal(await store.begin("Unlisted destination", async () => unknown), unknown);
    context.mock.timers.tick(3000);
    assert.equal(store.getSnapshot()?.phase, "loading");
    store.ready(unknown);
    assert.equal(store.getSnapshot()?.phase, "revealing");
});

test("readiness for an unresolved or different URL cannot release the loading screen", async (context) => {
    const store = fixture(context);
    const route = deferred<string>();
    const navigation = store.begin("Paris", () => route.promise);
    store.ready(paris);
    assert.equal(store.getSnapshot()?.pageReady, false);
    route.resolve(paris);
    await navigation;
    context.mock.timers.tick(3000);
    store.ready(kyoto);
    assert.equal(store.getSnapshot()?.pageReady, false);
    assert.equal(store.getSnapshot()?.phase, "loading");
    store.ready(paris);
    assert.equal(store.getSnapshot()?.phase, "revealing");
});

test("namesake destinations require full href identity, including query selectors", async (context) => {
    const store = fixture(context);
    const selected = `${paris}?country=USA`;
    await store.begin("Paris", async () => selected);
    context.mock.timers.tick(3000);
    for (const stale of [paris, `${paris}?country=FRA`, `${paris}?country=USA&providerId=other`]) {
        store.ready(stale);
        assert.equal(store.getSnapshot()?.pageReady, false);
        assert.equal(store.getSnapshot()?.phase, "loading");
    }
    store.ready(selected);
    assert.equal(store.getSnapshot()?.phase, "revealing");
});

test("a failed resolver gives a visible error and a fresh attempt can retry successfully", async (context) => {
    const store = fixture(context);
    assert.equal(
        await store.begin("Kyoto", async () => {
            throw new Error("Destination service unavailable");
        }),
        undefined
    );
    const failed = store.getSnapshot();
    assert.equal(failed?.phase, "error");
    assert.ok(failed?.error.trim(), "a failure must explain why loading stopped");
    context.mock.timers.tick(3000);
    store.ready(kyoto);
    assert.equal(store.getSnapshot()?.phase, "error");
    assert.equal(await store.begin("Kyoto", async () => kyoto), kyoto);
    assert.notEqual(store.getSnapshot()?.id, failed?.id);
    assert.equal(store.getSnapshot()?.phase, "loading");
    assert.equal(store.getSnapshot()?.introComplete, false);
    assert.equal(store.getSnapshot()?.pageReady, false);
    assert.equal(store.getSnapshot()?.error, "");
    store.ready(kyoto);
    context.mock.timers.tick(3000);
    assert.equal(store.getSnapshot()?.phase, "revealing");
});

test("a page failure after URL resolution stops loading and cannot be undone by late readiness", async (context) => {
    const store = fixture(context);
    await store.begin("Kyoto", async () => kyoto);
    store.fail("This destination could not be loaded.");
    assert.equal(store.getSnapshot()?.phase, "error");
    assert.equal(store.getSnapshot()?.error, "This destination could not be loaded.");
    context.mock.timers.tick(20000);
    store.ready(kyoto);
    assert.equal(store.getSnapshot()?.phase, "error");
});

test("a stalled resolver times out and aborts without depending on the transport honoring cancellation", async (context) => {
    const store = fixture(context);
    const route = deferred<string>();
    const signals: AbortSignal[] = [];
    const navigation = store.begin("Kyoto", (signal) => {
        signals.push(signal);
        return route.promise;
    });
    context.mock.timers.tick(14999);
    assert.equal(store.getSnapshot()?.phase, "loading");
    context.mock.timers.tick(1);
    await settle();
    assert.equal(signals[0].aborted, true);
    assert.equal(store.getSnapshot()?.phase, "error");
    assert.ok(store.getSnapshot()?.error.trim());
    assert.equal(await navigation, undefined);
    const failed = store.getSnapshot();
    route.resolve(kyoto);
    await settle();
    assert.deepEqual(store.getSnapshot(), failed);
});

test("a route that never reports readiness also times out, while completed reveals do not", async (context) => {
    const store = fixture(context);
    await store.begin("Kyoto", async () => kyoto);
    context.mock.timers.tick(15000);
    assert.equal(store.getSnapshot()?.phase, "error");
    await store.begin("Paris", async () => paris);
    store.ready(paris);
    context.mock.timers.tick(3000);
    assert.equal(store.getSnapshot()?.phase, "revealing");
    context.mock.timers.tick(30000);
    assert.equal(store.getSnapshot()?.phase, "revealing");
});

test("repeated selections abort the old request and ignore its late result and readiness", async (context) => {
    const store = fixture(context);
    const oldRoute = deferred<string>();
    const signals: AbortSignal[] = [];
    const oldNavigation = store.begin("Kyoto", (signal) => {
        signals.push(signal);
        return oldRoute.promise;
    });
    context.mock.timers.tick(2000);
    const oldId = store.getSnapshot()?.id;
    assert.equal(await store.begin("Paris", async () => paris), paris);
    assert.equal(signals[0].aborted, true);
    assert.equal(await oldNavigation, undefined);
    assert.notEqual(store.getSnapshot()?.id, oldId);
    oldRoute.resolve(kyoto);
    await settle();
    store.ready(kyoto);
    assert.equal(store.getSnapshot()?.href, paris);
    assert.equal(store.getSnapshot()?.name, "Paris");
    assert.equal(store.getSnapshot()?.pageReady, false);
    store.ready(paris);
    context.mock.timers.tick(2999);
    assert.equal(store.getSnapshot()?.phase, "loading");
    context.mock.timers.tick(1);
    assert.equal(store.getSnapshot()?.phase, "revealing");
});

test("a rejected obsolete request cannot fail a newer destination", async (context) => {
    const store = fixture(context);
    const oldRoute = deferred<string>();
    const oldNavigation = store.begin("Kyoto", () => oldRoute.promise);
    await store.begin("Paris", async () => paris);
    oldRoute.reject(new Error("Old request failed"));
    await settle();
    assert.equal(await oldNavigation, undefined);
    assert.equal(store.getSnapshot()?.phase, "loading");
    assert.equal(store.getSnapshot()?.href, paris);
    assert.equal(store.getSnapshot()?.error, "");
});

test("cancel returns to idle, settles navigation and clears pending work", async (context) => {
    const store = fixture(context);
    const route = deferred<string>();
    const signals: AbortSignal[] = [];
    const navigation = store.begin("Kyoto", (signal) => {
        signals.push(signal);
        return route.promise;
    });
    store.cancel();
    assert.equal(store.getSnapshot(), null);
    assert.equal(signals[0].aborted, true);
    assert.equal(await navigation, undefined);
    route.resolve(kyoto);
    context.mock.timers.tick(30000);
    await settle();
    store.ready(kyoto);
    assert.equal(store.getSnapshot(), null);
    await store.begin("Paris", async () => paris);
    assert.equal(store.getSnapshot()?.name, "Paris", "search can start again after cancellation");
});

test("disposing during navigation aborts work and prevents later notifications", async (context) => {
    const store = fixture(context);
    const route = deferred<string>();
    const signals: AbortSignal[] = [];
    const navigation = store.begin("Kyoto", (signal) => {
        signals.push(signal);
        return route.promise;
    });
    const notifications: unknown[] = [];
    store.subscribe(() => notifications.push(store.getSnapshot()));
    store.dispose();
    const notificationCount = notifications.length;
    assert.equal(signals[0].aborted, true);
    assert.equal(await navigation, undefined);
    route.resolve(kyoto);
    context.mock.timers.tick(30000);
    await settle();
    assert.equal(notifications.length, notificationCount);
});

test("subscriptions observe readiness and stop receiving changes after unsubscribe", async (context) => {
    const store = fixture(context);
    const notifications: unknown[] = [];
    const unsubscribe = store.subscribe(() => notifications.push(store.getSnapshot()));
    await store.begin("Kyoto", async () => kyoto);
    store.ready(kyoto);
    context.mock.timers.tick(3000);
    assert.ok(notifications.length >= 3);
    assert.deepEqual(notifications.at(-1), store.getSnapshot());
    const notificationCount = notifications.length;
    unsubscribe();
    store.cancel();
    assert.equal(notifications.length, notificationCount);
});

test("reduced motion skips the cinematic wait but still waits for real page readiness", async (context) => {
    const store = fixture(context, 0);
    await store.begin("Kyoto", async () => kyoto);
    context.mock.timers.tick(0);
    assert.equal(store.getSnapshot()?.introComplete, true);
    assert.equal(store.getSnapshot()?.phase, "loading");
    store.ready(kyoto);
    assert.equal(store.getSnapshot()?.phase, "revealing");
});

test("switching to reduced motion during an attempt removes only the animation gate", async (context) => {
    const store = fixture(context);
    const route = deferred<string>();
    const navigation = store.begin("Paris", () => route.promise);
    context.mock.timers.tick(500);
    store.finishIntro();
    assert.equal(store.getSnapshot()?.introComplete, true);
    assert.equal(store.getSnapshot()?.phase, "loading");
    route.resolve(paris);
    await navigation;
    assert.equal(store.getSnapshot()?.phase, "loading");
    store.ready(paris);
    assert.equal(store.getSnapshot()?.phase, "revealing");
    context.mock.timers.tick(30000);
    assert.equal(store.getSnapshot()?.phase, "revealing");
});

test("loading dialog focuses the modal container rather than Return to search so repeated Enter does not cancel", () => {
    const loadingHtml = renderToStaticMarkup(
        createElement(DestinationLoading, {
            state: {
                id: 1,
                name: "Paris",
                href: paris,
                phase: "loading",
                introComplete: false,
                pageReady: false,
                error: ""
            },
            reduced: true,
            mobile: false,
            onCancel() {},
            onRetry() {},
            onRevealed() {}
        })
    );
    assert.match(loadingHtml, /<div\b[^>]*role="dialog"[^>]*tabindex="-1"/);
    assert.doesNotMatch(loadingHtml, /<button\b[^>]*autofocus[^>]*>Return to search<\/button>/i);
});
