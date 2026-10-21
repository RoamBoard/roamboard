import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test, { type TestContext } from "node:test";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { publishAccountUpdate, signOut, type AuthUser } from "../src/lib/auth";
import type { DiscoveryCard } from "../src/lib/boards-discovery";

type Node = React.ReactElement<Record<string, unknown>>;
type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Instance = { slots: Slot[]; token: object };

function deferred<T>() {
    const holder: { resolve?: (value: T) => void } = {};
    const promise = new Promise<T>((resolve) => {
        holder.resolve = resolve;
    });
    return { promise, resolve: (value: T) => holder.resolve!(value) };
}

function card(boardId: number): DiscoveryCard {
    return {
        boardId,
        title: `Private journey ${boardId}`,
        description: "Account-specific result",
        status: "published",
        visibility: "friends",
        owner: { username: "previous_viewer", displayName: "Previous", photoUrl: null },
        destination: null,
        coverImageUrl: null,
        tags: [],
        durationDays: 1,
        activityCount: 1,
        savedCount: 1,
        savedByMe: true,
        firstPublishedAt: null,
        updatedAt: "2026-10-20T00:00:00Z",
        permissions: { canEditContent: true, canManageBoard: true }
    };
}

async function harness(t: TestContext, search = "") {
    const modules = createRequire(import.meta.url);
    const previousCss = modules.extensions[".css"];
    modules.extensions[".css"] = (module) => {
        module.exports = {};
    };
    const Page = await (async () => {
        try {
            return (await import("../src/components/features/boards/BoardsDiscovery")).default;
        } finally {
            if (previousCss) modules.extensions[".css"] = previousCss;
            else delete modules.extensions[".css"];
        }
    })();
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget() });
    const requests: Array<{ url: URL; resolve: (response: Response) => void }> = [];
    t.mock.method(globalThis, "fetch", (input: string | URL | Request) => {
        const pending = deferred<Response>();
        requests.push({ url: new URL(String(input)), resolve: pending.resolve });
        return pending.promise;
    });
    const instances = new Map<string, Instance>();
    const current: {
        instance?: Instance;
        cursor: number;
        effects: Array<() => void>;
        nodes: Array<{ node: Node; token: object }>;
    } = { cursor: 0, effects: [], nodes: [] };
    const slot = () => {
        assert.ok(current.instance);
        return (current.instance.slots[current.cursor++] ??= {});
    };
    const originals = {
        useMemo: React.useMemo,
        useId: React.useId,
        useState: React.useState,
        useRef: React.useRef,
        useEffect: React.useEffect,
        useSyncExternalStore: React.useSyncExternalStore
    };
    function intercept() {
        React.useId = () => {
            const cell = slot();
            return (cell.value ??= "filter-id") as string;
        };
        React.useMemo = ((factory: () => unknown, deps: readonly unknown[]) => {
            const cell = slot();
            if (!cell.deps || deps.some((dep, index) => !Object.is(dep, cell.deps![index]))) {
                cell.value = factory();
                cell.deps = deps;
            }
            return cell.value;
        }) as typeof React.useMemo;
        React.useState = ((initial: unknown) => {
            const cell = slot();
            if (!("value" in cell)) cell.value = typeof initial === "function" ? initial() : initial;
            return [
                cell.value,
                (next: unknown) => {
                    cell.value = typeof next === "function" ? next(cell.value) : next;
                }
            ];
        }) as typeof React.useState;
        React.useRef = ((initial: unknown) => {
            const cell = slot();
            return (cell.value ??= { current: initial });
        }) as typeof React.useRef;
        React.useEffect = (effect, deps) => {
            const cell = slot();
            if (!cell.deps || !deps || deps.some((dep, index) => !Object.is(dep, cell.deps![index]))) {
                current.effects.push(() => {
                    cell.cleanup?.();
                    cell.cleanup = effect() || undefined;
                });
                cell.deps = deps;
            }
        };
        React.useSyncExternalStore = ((_subscribe: unknown, snapshot: () => unknown) =>
            snapshot()) as typeof React.useSyncExternalStore;
    }
    const navigations: string[] = [];
    const router = {
        bfcacheId: "lifetime",
        back() {},
        forward() {},
        refresh() {},
        push: (href: string) => navigations.push(href),
        replace: (href: string) => navigations.push(href),
        prefetch() {}
    };
    const params = { value: new URLSearchParams(search) };
    // Only local discovery components run. Gallery, card, icon and Link children remain
    // elements. This verifies state/effect lifetimes, not React DOM focus or gestures.
    const local = /^(BoardsDiscovery|BoardSearch|SearchResults|Featured|Discovery|Viewer|GeographicFilters)/;
    function render() {
        const used = new Set<string>();
        current.effects = [];
        current.nodes = [];
        function visit(root: ReactNode, path: string) {
            Children.toArray(root).forEach((child, index) => {
                if (!isValidElement<Record<string, unknown>>(child)) return;
                const name = typeof child.type === "function" ? child.type.name : String(child.type);
                const identity = `${path}/${name}:${child.key ?? index}`;
                used.add(identity);
                const instance = instances.get(identity) ?? { slots: [], token: {} };
                instances.set(identity, instance);
                current.nodes.push({ node: child, token: instance.token });
                if (typeof child.type === "function" && local.test(name)) {
                    current.instance = instance;
                    current.cursor = 0;
                    const result = (child.type as (props: Record<string, unknown>) => ReactNode)(child.props);
                    visit(result, identity);
                } else visit(child.props.children as ReactNode, identity);
            });
        }
        function Probe() {
            intercept();
            try {
                visit(createElement(Page), "root");
            } finally {
                Object.assign(React, originals);
            }
            return null;
        }
        renderToStaticMarkup(
            createElement(
                AppRouterContext.Provider,
                { value: router },
                createElement(SearchParamsContext.Provider, { value: params.value }, createElement(Probe))
            )
        );
        for (const [key, instance] of instances) {
            if (!used.has(key)) {
                instance.slots.forEach((cell) => cell.cleanup?.());
                instances.delete(key);
            }
        }
        current.effects.forEach((effect) => effect());
        return current.nodes;
    }
    const find = (predicate: (node: Node) => boolean) => {
        const found = render().find(({ node }) => predicate(node));
        assert.ok(found, "The production page must expose the requested interaction");
        return found;
    };
    const input = () => find((node) => node.props.id === "boards-search");
    const invoke = (node: Node, handler: string, event?: unknown) => {
        assert.equal(typeof node.props[handler], "function");
        (node.props[handler] as (event: unknown) => void)(event);
    };
    const settle = async () => {
        await new Promise<void>((resolve) => setImmediate(resolve));
        render();
    };
    const advance = async (ms = 220) => {
        render();
        t.mock.timers.tick(ms);
        await settle();
    };
    const respond = async (path: string, items: DiscoveryCard[] = []) => {
        const pending = requests.find((request) => request.url.pathname.endsWith(path));
        assert.ok(pending, `Expected real API helper request for ${path}`);
        requests.splice(requests.indexOf(pending), 1);
        pending.resolve(
            Response.json(
                path === "/auth/me"
                    ? { data: viewer("first") }
                    : { data: { items, total: items.length, page: 1, hasMore: false } }
            )
        );
        await settle();
    };
    t.after(() => {
        instances.forEach((instance) => instance.slots.forEach((cell) => cell.cleanup?.()));
        if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
        else Reflect.deleteProperty(globalThis, "window");
    });
    render();
    return { render, input, invoke, settle, advance, respond, requests, navigations, params };
}

function viewer(userId: string): AuthUser {
    return { userId, username: userId, displayName: userId };
}

test("emptying a submitted Boards search restores discovery without pressing Clear", async (t) => {
    const page = await harness(t, "q=Bali&page=3");
    page.invoke(page.input().node, "onChange", { target: { value: "" } });
    assert.equal(page.navigations.at(-1), "/boards");
    page.params.value = new URLSearchParams();
    await page.advance();
    assert.ok(page.requests.some((request) => request.url.pathname.endsWith("/boards/featured")));
    assert.equal(page.input().node.props.value, "");
});

test("selecting countries keeps the dropdown open and preserves its search and the main draft", async (t) => {
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: { addEventListener() {}, removeEventListener() {} }
    });
    const page = await harness(t);
    t.after(() => {
        if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
        else Reflect.deleteProperty(globalThis, "document");
    });
    page.invoke(page.input().node, "onChange", { target: { value: "Summer plans" } });
    const countryMenu = () =>
        page.render().find(({ node }) => node.type === "details" && node.props["data-filter"] === "countries")!;
    const countrySearch = () => page.render().find(({ node }) => node.props["aria-label"] === "Find countries")!;
    const summary = page.render().find(({ node }) => node.type === "summary")!;
    page.invoke(summary.node, "onClick", { preventDefault() {} });
    page.invoke(countrySearch().node, "onChange", { target: { value: "Sweden" } });
    const before = countryMenu();
    const checkbox = page.render().find(({ node }) => node.type === "input" && node.props.type === "checkbox")!;
    page.invoke(checkbox.node, "onChange");
    assert.equal(new URL(page.navigations.at(-1)!, "http://localhost").searchParams.get("countries"), "SWE");
    page.params.value = new URL(page.navigations.at(-1)!, "http://localhost").searchParams;
    const after = countryMenu();
    assert.equal(after.token, before.token, "Country selection must retain the mounted dropdown");
    assert.equal(after.node.props.open, true);
    assert.equal(countrySearch().node.props.value, "Sweden");
    assert.equal(page.input().node.props.value, "Summer plans");
    const selected = page.render().find(({ node }) => node.type === "input" && node.props.type === "checkbox")!;
    assert.equal(selected.node.props.checked, true);
});

function visibleBoardIds(nodes: Array<{ node: Node }>) {
    return nodes
        .flatMap(({ node }) => {
            const board = node.props.board as { id?: string } | undefined;
            const boards = node.props.boards as
                Array<{ photo?: { id: string }; summary?: { boardId: number } }> | undefined;
            return [board?.id, ...(boards ?? []).map((item) => item.photo?.id ?? item.summary?.boardId)].filter(
                Boolean
            );
        })
        .map(String);
}

test("typing and the input identity survive delayed initial account identification; keyboard search remains URL-backed", async (t) => {
    const page = await harness(t);
    const before = page.input();
    page.invoke(before.node, "onFocus");
    page.invoke(before.node, "onChange", { target: { value: "Stockholm cafés" } });
    await page.advance();
    await page.respond("/boards/search/suggestions", [card(901)]);
    assert.equal(page.input().node.props["aria-expanded"], true);
    page.invoke(page.input().node, "onKeyDown", { key: "ArrowDown", preventDefault() {} });
    assert.equal(page.input().node.props["aria-activedescendant"], "board-suggestion-901");
    await page.respond("/auth/me");
    assert.equal(
        page.input().node.props["aria-activedescendant"],
        undefined,
        "A previous viewer's selected suggestion must be invalidated"
    );
    assert.equal(page.input().token, before.token, "Auth resolution must not replace the focus-bearing input");
    assert.equal(page.input().node.props.value, "Stockholm cafés");
    assert.equal(page.input().node.props["aria-expanded"], true);
    const form = page.render().find(({ node }) => node.props.role === "search")!;
    page.invoke(form.node, "onSubmit", { preventDefault() {} });
    assert.equal(page.navigations.at(-1), "/boards?q=Stockholm+caf%C3%A9s&page=1");
});

test("account switching invalidates suggestions and all personal collections, ignores late responses, and preserves the draft", async (t) => {
    const page = await harness(t);
    await page.respond("/auth/me");
    page.invoke(page.input().node, "onChange", { target: { value: "Stockholm" } });
    await page.advance();
    await page.respond("/boards/search/suggestions", [card(902)]);
    await page.respond("/boards/mine", [card(903)]);
    await page.respond("/boards/saved", [card(904)]);
    assert.ok(visibleBoardIds(page.render()).includes("903"));
    page.invoke(page.input().node, "onChange", { target: { value: "Stockholm coast" } });
    await page.advance();
    window.dispatchEvent(new Event("focus"));
    const oldRequests = [...page.requests];
    for (const path of ["/boards/search/suggestions", "/boards/mine", "/boards/saved"]) {
        assert.ok(
            oldRequests.some((request) => request.url.pathname.endsWith(path)),
            `Old viewer should have pending ${path}`
        );
    }
    publishAccountUpdate(viewer("second"));
    page.render();
    assert.equal(page.input().node.props.value, "Stockholm coast");
    assert.equal(page.input().node.props["aria-activedescendant"], undefined);
    assert.ok(!page.render().some(({ node }) => node.props.id === "board-suggestion-902"));
    assert.ok(!visibleBoardIds(page.render()).some((id) => ["903", "904"].includes(id)));
    oldRequests.forEach((request) => {
        page.requests.splice(page.requests.indexOf(request), 1);
        request.resolve(Response.json({ data: { items: [card(999)] } }));
    });
    await page.settle();
    assert.ok(!visibleBoardIds(page.render()).includes("999"));
    assert.ok(!page.render().some(({ node }) => node.props.id === "board-suggestion-999"));
    await page.advance();
    await page.respond("/boards/mine", [card(905)]);
    assert.ok(visibleBoardIds(page.render()).includes("905"));
});

test("returning to a previous account cannot restore its old keyboard suggestion index", async (t) => {
    const page = await harness(t);
    await page.respond("/auth/me");
    page.invoke(page.input().node, "onChange", { target: { value: "Stockholm" } });
    await page.advance();
    await page.respond("/boards/search/suggestions", [card(908), card(909)]);
    page.invoke(page.input().node, "onKeyDown", { key: "ArrowDown", preventDefault() {} });
    assert.equal(page.input().node.props["aria-activedescendant"], "board-suggestion-908");
    publishAccountUpdate(viewer("second"));
    page.render();
    publishAccountUpdate(viewer("first"));
    page.render();
    await page.advance();
    await page.respond("/boards/search/suggestions", [card(910), card(911)]);
    assert.equal(page.input().node.props["aria-activedescendant"], undefined);
    page.invoke(page.input().node, "onKeyDown", { key: "ArrowDown", preventDefault() {} });
    assert.equal(page.input().node.props["aria-activedescendant"], "board-suggestion-910");
});

test("submitted search revalidates for account changes and logout removes protected results without erasing URL query", async (t) => {
    const page = await harness(t, "q=Stockholm&page=2&location=off");
    await page.respond("/auth/me");
    await page.advance(0);
    await page.respond("/boards/search", [card(906)]);
    assert.ok(visibleBoardIds(page.render()).includes("906"));
    publishAccountUpdate(viewer("second"));
    page.render();
    assert.equal(page.input().node.props.value, "Stockholm");
    assert.ok(!visibleBoardIds(page.render()).includes("906"));
    await page.advance(0);
    const secondRequest = page.requests.find((request) => request.url.pathname.endsWith("/boards/search"));
    assert.ok(secondRequest);
    assert.equal(secondRequest.url.searchParams.get("page"), "2");
    assert.equal(secondRequest.url.searchParams.get("location"), "off");
    const logout = signOut();
    await page.respond("/auth/logout");
    await logout;
    page.render();
    secondRequest.resolve(Response.json({ data: { items: [card(907)], total: 1 } }));
    await page.settle();
    assert.ok(!visibleBoardIds(page.render()).includes("907"));
    assert.equal(page.input().node.props.value, "Stockholm");
});

test("logout before initial identification clears cookie-authorized results and rejects their late refresh", async (t) => {
    const page = await harness(t, "q=Stockholm");
    await page.advance(0);
    await page.respond("/boards/search", [card(912)]);
    assert.ok(visibleBoardIds(page.render()).includes("912"));
    window.dispatchEvent(new Event("focus"));
    const stale = page.requests.find((request) => request.url.pathname.endsWith("/boards/search"));
    assert.ok(stale);
    const logout = signOut();
    page.render();
    assert.ok(!visibleBoardIds(page.render()).includes("912"), "Logout must clear results even before /me completes");
    await page.respond("/auth/logout");
    await logout;
    stale.resolve(Response.json({ data: { items: [card(913)], total: 1 } }));
    await page.respond("/auth/me");
    await page.settle();
    assert.ok(!visibleBoardIds(page.render()).some((id) => ["912", "913"].includes(id)));
    assert.equal(page.input().node.props.value, "Stockholm");
});
