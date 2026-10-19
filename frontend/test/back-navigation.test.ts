import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import BackLink from "../src/components/ui/BackLink";
import CreatorLeaveDialog from "../src/components/features/boards/CreatorLeaveDialog";
import { getBackHref, installBackNavigation } from "../src/lib/back-navigation";

type Entry = { state: unknown; href: string };

// Models only the native history operations the tracker wraps. Pop restores the entry's own state.
function browserHistory(href: string, state: unknown = null) {
    const location = { href };
    const entries: Entry[] = [{ href, state }];
    const current = { index: 0 };
    const resolve = (url?: string | URL | null) => new URL(url ?? location.href, location.href).href;
    const history = {
        get state() {
            return entries[current.index].state;
        },
        pushState(data: unknown, _unused: string, url?: string | URL | null) {
            const nextHref = resolve(url);
            entries.splice(current.index + 1);
            entries.push({ state: structuredClone(data), href: nextHref });
            current.index += 1;
            location.href = nextHref;
        },
        replaceState(data: unknown, _unused: string, url?: string | URL | null) {
            const nextHref = resolve(url);
            entries[current.index] = { state: structuredClone(data), href: nextHref };
            location.href = nextHref;
        }
    };
    return {
        history,
        location,
        pop(delta: number) {
            const next = current.index + delta;
            assert.ok(next >= 0 && next < entries.length);
            current.index = next;
            location.href = entries[next].href;
        }
    };
}

test("installing on a direct entry preserves router state without inventing a predecessor", () => {
    const browser = browserHistory("https://roamboard.test/settings", { __NA: true, tree: ["settings"] });
    const notices: string[] = [];
    const cleanup = installBackNavigation(browser.history, browser.location, () => notices.push(browser.location.href));
    assert.equal(getBackHref(browser.history.state), null);
    assert.equal((browser.history.state as Record<string, unknown>).__NA, true);
    assert.deepEqual((browser.history.state as Record<string, unknown>).tree, ["settings"]);
    assert.equal(notices.length, 1);
    cleanup();
});

test("push records the actual preceding internal URL including its query and hash", () => {
    const browser = browserHistory("https://roamboard.test/discover?country=Sweden#stories");
    const cleanup = installBackNavigation(browser.history, browser.location, () => {});
    browser.history.pushState({ __NA: true, tree: ["board"] }, "", "/boards/12?day=2#map");
    assert.equal(getBackHref(browser.history.state), "/discover?country=Sweden#stories");
    assert.deepEqual((browser.history.state as Record<string, unknown>).tree, ["board"]);
    browser.history.pushState({ __NA: true }, "", "/settings");
    assert.equal(getBackHref(browser.history.state), "/boards/12?day=2#map");
    cleanup();
});

test("replace preserves the entry's predecessor and the new router state", () => {
    const browser = browserHistory("https://roamboard.test/discover");
    const cleanup = installBackNavigation(browser.history, browser.location, () => {});
    browser.history.pushState({ tree: ["settings"] }, "", "/settings");
    browser.history.replaceState(
        { tree: ["profile"], roamboardBackHref: "/incorrect" },
        "",
        "/profile/new_name?updated=1"
    );
    assert.equal(getBackHref(browser.history.state), "/discover");
    assert.deepEqual((browser.history.state as Record<string, unknown>).tree, ["profile"]);
    cleanup();
});

test("reinstalling after a refresh retains the predecessor stored on that history entry", () => {
    const browser = browserHistory("https://roamboard.test/discover");
    const cleanup = installBackNavigation(browser.history, browser.location, () => {});
    browser.history.pushState({ tree: ["settings"] }, "", "/settings");
    cleanup();
    const afterRefresh = installBackNavigation(browser.history, browser.location, () => {});
    assert.equal(getBackHref(browser.history.state), "/discover");
    assert.deepEqual((browser.history.state as Record<string, unknown>).tree, ["settings"]);
    afterRefresh();
});

test("pop restores the previous entry's predecessor and a new branch uses the restored current URL", () => {
    const browser = browserHistory("https://roamboard.test/discover?sort=new");
    const cleanup = installBackNavigation(browser.history, browser.location, () => {});
    browser.history.pushState({}, "", "/boards/12#day-2");
    browser.history.pushState({}, "", "/profile/traveler");
    browser.pop(-1);
    assert.equal(getBackHref(browser.history.state), "/discover?sort=new");
    browser.history.pushState({}, "", "/settings");
    assert.equal(getBackHref(browser.history.state), "/boards/12#day-2");
    browser.pop(-1);
    browser.pop(-1);
    assert.equal(getBackHref(browser.history.state), null);
    cleanup();
});

test("authentication and welcome entries never become Back destinations", () => {
    for (const source of ["/", "/welcome?from=email", "/login#google", "/signup?invite=abc"]) {
        const browser = browserHistory(`https://roamboard.test${source}`);
        const cleanup = installBackNavigation(browser.history, browser.location, () => {});
        browser.history.pushState({}, "", "/settings");
        assert.equal(getBackHref(browser.history.state), null, source);
        cleanup();
    }
});

test("invalid, external and authentication history markers have no usable Back URL", () => {
    for (const state of [
        null,
        undefined,
        8,
        "value",
        {},
        { roamboardBackHref: 1 },
        ...[
            "https://outside.test/boards/12",
            "//outside.test/boards/12",
            "/\\outside.test/boards/12",
            "javascript:alert(1)",
            "boards/12",
            "/",
            "/welcome?ref=mail",
            "/login#google",
            "/signup?invite=abc"
        ].map((roamboardBackHref) => ({ roamboardBackHref }))
    ]) {
        assert.equal(getBackHref(state), null);
    }
    assert.equal(getBackHref({ roamboardBackHref: "/boards/12?day=2#map" }), "/boards/12?day=2#map");
});

test("cleanup restores native history methods and stops tracker notifications", () => {
    const browser = browserHistory("https://roamboard.test/discover");
    const nativePush = browser.history.pushState;
    const nativeReplace = browser.history.replaceState;
    const notices: string[] = [];
    const cleanup = installBackNavigation(browser.history, browser.location, () => notices.push(browser.location.href));
    browser.history.pushState({}, "", "/settings");
    assert.equal(notices.length, 2);
    cleanup();
    assert.equal(browser.history.pushState, nativePush);
    assert.equal(browser.history.replaceState, nativeReplace);
    browser.history.pushState({}, "", "/profile/traveler");
    assert.equal(getBackHref(browser.history.state), null);
    assert.equal(notices.length, 2);
});

type Props = { children?: ReactNode; [name: string]: unknown };

function elements(node: ReactNode): Array<{ type: unknown; props: Props }> {
    if (!isValidElement<Props>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(elements)];
}

function captureBackLink(context: TestContext, previous: string | null) {
    const windowBefore = Object.getOwnPropertyDescriptor(globalThis, "window");
    const browser = browserHistory("https://roamboard.test/settings", { roamboardBackHref: previous });
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: Object.assign(new EventTarget(), { history: browser.history, location: browser.location })
    });
    context.after(() => {
        if (windowBefore) Object.defineProperty(globalThis, "window", windowBefore);
        else Reflect.deleteProperty(globalThis, "window");
    });
    const calls: Array<{ action: string; href?: string }> = [];
    const router = {
        bfcacheId: "back-test",
        back: () => {
            calls.push({ action: "back" });
        },
        forward: () => {},
        refresh: () => {},
        push: () => {},
        replace: (href: string) => {
            calls.push({ action: "replace", href });
        },
        prefetch: () => {}
    };
    const holder: { tree: ReactNode } = { tree: null };
    function Probe() {
        const original = React.useSyncExternalStore;
        React.useSyncExternalStore = ((_subscribe: unknown, snapshot: () => unknown) =>
            snapshot()) as typeof React.useSyncExternalStore;
        try {
            holder.tree = BackLink({ fallbackHref: "/profile/traveler" });
            return holder.tree;
        } finally {
            React.useSyncExternalStore = original;
        }
    }
    const markup = renderToStaticMarkup(
        createElement(AppRouterContext.Provider, { value: router }, createElement(Probe))
    );
    const link = elements(holder.tree).find((node) => node.type === "a");
    assert.ok(link, "Back must be an ordinary anchor for browser and leave-guard behavior");
    return { markup, link, calls };
}

function click(
    overrides: Partial<{
        button: number;
        metaKey: boolean;
        ctrlKey: boolean;
        shiftKey: boolean;
        altKey: boolean;
        defaultPrevented: boolean;
    }> = {}
) {
    const event = {
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        defaultPrevented: false,
        preventDefault: () => {
            event.defaultPrevented = true;
        },
        ...overrides
    };
    return event;
}

test("Back has a visible label and arrow with a target at least 44 pixels high", (context) => {
    const { markup, link } = captureBackLink(context, "/boards/12?day=2#map");
    assert.match(markup, />Back</);
    assert.match(markup, /<svg\b/);
    assert.match(String(link.props.className), /(?:\bmin-h-11\b|\bh-11\b|\bmin-h-\[44px\]|\bmin-h-\[2\.75rem\])/);
    assert.equal(link.props.href, "/boards/12?day=2#map");
});

test("an ordinary click returns through history when an internal predecessor is tracked", (context) => {
    const { link, calls } = captureBackLink(context, "/boards/12?day=2#map");
    assert.equal(typeof link.props.onClick, "function");
    const event = click();
    (link.props.onClick as (event: ReturnType<typeof click>) => void)(event);
    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(calls, [{ action: "back" }]);
});

test("a direct entry replaces itself with the fallback instead of leaving the app", (context) => {
    const { link, calls } = captureBackLink(context, null);
    assert.equal(link.props.href, "/profile/traveler");
    assert.equal(typeof link.props.onClick, "function");
    const event = click();
    (link.props.onClick as (event: ReturnType<typeof click>) => void)(event);
    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(calls, [{ action: "replace", href: "/profile/traveler" }]);
});

test("modified and middle clicks keep the anchor's native behavior", (context) => {
    const { link, calls } = captureBackLink(context, "/boards/12");
    assert.equal(typeof link.props.onClick, "function");
    for (const overrides of [
        { metaKey: true },
        { ctrlKey: true },
        { shiftKey: true },
        { altKey: true },
        { button: 1 }
    ]) {
        const event = click(overrides);
        (link.props.onClick as (event: ReturnType<typeof click>) => void)(event);
        assert.equal(event.defaultPrevented, false);
    }
    assert.deepEqual(calls, []);
});

test("a leave guard that already prevented the click can stop Back navigation", (context) => {
    const { link, calls } = captureBackLink(context, "/boards/12");
    assert.equal(typeof link.props.onClick, "function");
    const event = click();
    event.preventDefault();
    (link.props.onClick as (event: ReturnType<typeof click>) => void)(event);
    assert.deepEqual(calls, []);
});

test("confirming an editor exit preserves Back, fallback replacement, and ordinary link behavior", () => {
    for (const navigation of ["back", "replace", "push"] as const) {
        const calls: string[] = [];
        const holder: { props?: { onCancel: () => void; onConfirm: () => void } } = {};
        const router = {
            bfcacheId: "leave-test",
            back: () => calls.push("back"),
            forward: () => {},
            refresh: () => {},
            push: (href: string) => calls.push(`push:${href}`),
            replace: (href: string) => calls.push(`replace:${href}`),
            prefetch: () => {}
        };
        function Probe() {
            const props = {
                href: "https://roamboard.test/create?mode=scratch#paths",
                navigation,
                onClose: () => calls.push("close")
            };
            holder.props = CreatorLeaveDialog(props).props;
            return null;
        }
        renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, createElement(Probe)));
        assert.ok(holder.props);
        holder.props.onCancel();
        assert.deepEqual(calls, ["close"]);
        calls.length = 0;
        holder.props.onConfirm();
        assert.deepEqual(calls, ["close", navigation === "back" ? "back" : `${navigation}:/create?mode=scratch#paths`]);
    }
});
