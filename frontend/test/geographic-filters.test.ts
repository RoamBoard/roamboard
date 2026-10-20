import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test, { type TestContext } from "node:test";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SearchParamsContext, PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import GeographicFilters from "../src/components/features/boards/GeographicFilters";

type Props = { children?: ReactNode; [key: string]: unknown };
function elements(node: ReactNode): Array<{ type: unknown; props: Props }> {
    if (!isValidElement<Props>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(elements)];
}
function wrap(node: ReactNode, search: string, navigations: string[], pathname = "/boards/collections/map") {
    const router = {
        back() {},
        forward() {},
        refresh() {},
        prefetch() {},
        push: (href: string) => navigations.push(href),
        replace: (href: string) => navigations.push(href)
    };
    return createElement(
        AppRouterContext.Provider,
        { value: router as unknown as Parameters<typeof AppRouterContext.Provider>[0]["value"] },
        createElement(
            SearchParamsContext.Provider,
            { value: new URLSearchParams(search) },
            createElement(PathnameContext.Provider, { value: pathname }, node)
        )
    );
}
function renderFilters(search: string) {
    const navigations: string[] = [];
    const holder: { nodes: ReturnType<typeof elements> } = { nodes: [] };
    function Probe() {
        const tree = GeographicFilters();
        holder.nodes = elements(tree);
        return tree;
    }
    const html = renderToStaticMarkup(wrap(createElement(Probe), search, navigations));
    return { nodes: holder.nodes, navigations, html };
}

test("rapid country changes accumulate before navigation commits", () => {
    const { nodes, navigations } = renderFilters("q=food&page=3");
    const checkboxes = nodes.filter((node) => node.type === "input" && node.props.type === "checkbox");
    (checkboxes[0].props.onChange as () => void)();
    (checkboxes[1].props.onChange as () => void)();
    const first = new URL(navigations[0], "https://roamboard.test").searchParams;
    const second = new URL(navigations[1], "https://roamboard.test").searchParams;
    assert.equal(second.getAll("countries").length, 2);
    assert.ok(second.getAll("countries").includes(first.get("countries")!));
    assert.equal(second.get("q"), "food");
    assert.equal(second.has("page"), false);
});

function globalValue(t: TestContext, name: string, value: unknown) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
        if (previous) Object.defineProperty(globalThis, name, previous);
        else Reflect.deleteProperty(globalThis, name);
    });
}

function interactiveFilters(t: TestContext, effects?: React.EffectCallback[]) {
    const slots: unknown[] = [];
    const cursor = { value: 0 };
    t.mock.method(React, "useState", ((initial: unknown) => {
        const index = cursor.value++;
        if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
        return [
            slots[index],
            (next: unknown) => {
                slots[index] = typeof next === "function" ? next(slots[index]) : next;
            }
        ];
    }) as typeof React.useState);
    t.mock.method(React, "useRef", ((initial: unknown) => {
        const index = cursor.value++;
        slots[index] ??= { current: initial };
        return slots[index];
    }) as typeof React.useRef);
    t.mock.method(React, "useEffect", (effect: React.EffectCallback) => {
        effects?.push(effect);
    });
    return () => {
        cursor.value = 0;
        return renderFilters("").nodes;
    };
}

test("only one geography dropdown opens and clicking its summary again closes it", (t) => {
    const render = interactiveFilters(t);
    const toggle = (index: number) => {
        const summary = render().filter((node) => node.type === "summary")[index];
        const event = {
            prevented: false,
            preventDefault() {
                this.prevented = true;
            }
        };
        (summary.props.onClick as (event: unknown) => void)(event);
        assert.equal(event.prevented, true);
    };
    const opened = () =>
        render()
            .filter((node) => node.type === "details")
            .map((node) => Boolean(node.props.open));
    assert.deepEqual(opened(), [false, false]);
    toggle(0);
    assert.deepEqual(opened(), [true, false]);
    toggle(1);
    assert.deepEqual(opened(), [false, true]);
    toggle(1);
    assert.deepEqual(opened(), [false, false]);
});

test("country options show a local SVG flag and three-letter code after the country; continent chips use title case", () => {
    const { nodes, html } = renderFilters("continents=europe&continents=north-america");
    const country = nodes.find(
        (node) =>
            node.type === "label" &&
            renderToStaticMarkup(createElement("div", null, node.props.children)).includes("Sweden")
    );
    assert.ok(country);
    const markup = renderToStaticMarkup(createElement("div", null, country.props.children));
    assert.match(markup, /src="[^"]*\.svg"/);
    assert.ok(markup.indexOf("Sweden") < markup.indexOf("SWE"));
    assert.match(html, /Europe/);
    const chips = nodes.filter((node) =>
        ["Remove europe", "Remove north-america"].includes(String(node.props["aria-label"]))
    );
    assert.equal(chips.length, 2);
    assert.match(
        renderToStaticMarkup(
            createElement(
                "div",
                null,
                chips.map((chip, index) => createElement("span", { key: index }, chip.props.children))
            )
        ),
        /Europe.*North America/
    );
});

test("dropdown arrow navigation stays inside its controls and never reaches Board shortcuts", (t) => {
    globalValue(t, "HTMLInputElement", class {});
    globalValue(t, "requestAnimationFrame", (callback: () => void) => callback());
    const render = interactiveFilters(t);
    const firstSummary = render().find((node) => node.type === "summary")!;
    (firstSummary.props.onClick as (event: unknown) => void)({ preventDefault() {} });
    const details = render().find((node) => node.type === "details")!;
    const focused: number[] = [];
    const controls = [0, 1, 2].map((index) => ({ focus: () => focused.push(index), closest: () => null }));
    const currentTarget = {
        dataset: { filter: "countries" },
        querySelectorAll: () => controls,
        querySelector: () => ({ focus() {} })
    };
    for (const key of ["ArrowDown", "ArrowUp"]) {
        const event = {
            key,
            target: controls[1],
            currentTarget,
            prevented: false,
            stopped: false,
            preventDefault() {
                this.prevented = true;
            },
            stopPropagation() {
                this.stopped = true;
            }
        };
        (details.props.onKeyDown as (event: unknown) => void)(event);
        assert.equal(event.prevented, true, key + " must not scroll the page");
        assert.equal(event.stopped, true, key + " must not reach Board keyboard handlers");
    }
    assert.deepEqual(focused, [2, 0]);
});

test("outside pointer/focus dismisses an open dropdown; menu interactions stay open and Escape returns focus", (t) => {
    class Target {}
    globalValue(t, "Node", Target);
    const listeners = new Map<string, (event: { target: unknown }) => void>();
    globalValue(t, "document", {
        addEventListener: (type: string, callback: (event: { target: unknown }) => void) =>
            listeners.set(type, callback),
        removeEventListener: (type: string) => listeners.delete(type)
    });
    const effects: React.EffectCallback[] = [];
    const render = interactiveFilters(t, effects);
    const inside = new Target();
    const root = { querySelector: () => ({ contains: (target: unknown) => target === inside }) };
    const open = () => {
        const nodes = render();
        (nodes[0].props.ref as { current: unknown }).current = root;
        (nodes.find((node) => node.type === "summary")!.props.onClick as (event: unknown) => void)({
            preventDefault() {}
        });
        effects.length = 0;
        const opened = render();
        const cleanup = effects[0]();
        return { opened, cleanup };
    };
    for (const type of ["pointerdown", "focusin"]) {
        const { cleanup } = open();
        listeners.get(type)!({ target: inside });
        assert.equal(render().find((node) => node.type === "details")!.props.open, true);
        listeners.get(type)!({ target: new Target() });
        assert.equal(render().find((node) => node.type === "details")!.props.open, false);
        if (typeof cleanup === "function") cleanup();
        assert.equal(listeners.size, 0);
    }
    const { opened, cleanup } = open();
    const focus = { called: false };
    (opened.find((node) => node.type === "details")!.props.onKeyDown as (event: unknown) => void)({
        key: "Escape",
        preventDefault() {},
        stopPropagation() {},
        currentTarget: {
            querySelector: () => ({
                focus: () => {
                    focus.called = true;
                }
            })
        }
    });
    assert.equal(render().find((node) => node.type === "details")!.props.open, false);
    assert.equal(focus.called, true);
    if (typeof cleanup === "function") cleanup();
});

test("changing continent selection preserves query, sort and fixed map source while resetting page", () => {
    const { nodes, navigations } = renderFilters(
        "handle=friend&country=IDN&collection=both&q=Food&sort=title-desc&page=3&countries=BGD"
    );
    const label = nodes.find(
        (node) =>
            node.type === "label" &&
            elements(createElement("div", null, node.props.children)).some((child) => child.props.children === "Europe")
    )!;
    const checkbox = Children.toArray(label.props.children)
        .flatMap(elements)
        .find((node) => node.type === "input")!;
    (checkbox.props.onChange as () => void)();
    const next = new URL(navigations[0], "http://localhost");
    assert.equal(next.pathname, "/boards/collections/map");
    for (const [key, value] of Object.entries({
        handle: "friend",
        country: "IDN",
        collection: "both",
        q: "Food",
        sort: "title-desc",
        countries: "BGD",
        continents: "europe"
    })) {
        assert.equal(next.searchParams.get(key), value);
    }
    assert.equal(next.searchParams.has("page"), false);
});

test("removing a chip only removes its selection; Clear filters retains source, text and sort", () => {
    const { nodes, navigations, html } = renderFilters(
        "handle=friend&country=IDN&q=Food&sort=title-asc&page=4&countries=BGD&countries=FRA&continents=europe"
    );
    assert.match(html, /Countries \(2\)/);
    const chip = nodes.find((node) => node.props["aria-label"] === "Remove BGD")!;
    (chip.props.onClick as () => void)();
    const single = new URL(navigations[0], "http://localhost");
    assert.deepEqual(single.searchParams.getAll("countries"), ["FRA"]);
    assert.deepEqual(single.searchParams.getAll("continents"), ["europe"]);
    const clear = nodes.find((node) => node.type === "button" && node.props.children === "Clear filters")!;
    (clear.props.onClick as () => void)();
    const cleared = new URL(navigations[1], "http://localhost");
    for (const key of ["countries", "continents", "page"]) assert.equal(cleared.searchParams.has(key), false);
    for (const [key, value] of Object.entries({ handle: "friend", country: "IDN", q: "Food", sort: "title-asc" })) {
        assert.equal(cleared.searchParams.get(key), value);
    }
});

test("Boards filter-only opens full results and sends geography to results and text suggestions", async (t) => {
    const modules = createRequire(import.meta.url);
    const previous = modules.extensions[".css"];
    modules.extensions[".css"] = (module) => {
        module.exports = {};
    };
    const Content = await (async () => {
        try {
            return (await import("../src/components/features/boards/BoardsDiscovery")).BoardsDiscoveryContent;
        } finally {
            if (previous) modules.extensions[".css"] = previous;
            else delete modules.extensions[".css"];
        }
    })();
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const effects: Array<() => void | (() => void)> = [];
    t.mock.method(React, "useEffect", (effect: () => void | (() => void)) => {
        if (String(effect).includes("store.load")) effects.push(effect);
    });
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: Object.assign(new EventTarget(), { location: { href: "http://localhost/boards" } })
    });
    t.after(() => {
        if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
        else Reflect.deleteProperty(globalThis, "window");
    });
    const requests: URL[] = [];
    t.mock.method(globalThis, "fetch", async (input: string) => {
        requests.push(new URL(input));
        return Response.json({ data: { items: [], total: 0, page: 1, limit: 20, hasMore: false } });
    });
    for (const query of ["", "Food"]) {
        requests.length = 0;
        effects.length = 0;
        const html = renderToStaticMarkup(
            wrap(
                createElement(Content, {
                    query,
                    page: 2,
                    location: "off",
                    geography: "countries=BGD&countries=FRA&continents=europe",
                    account: { ready: true, user: null }
                }),
                "countries=BGD&countries=FRA&continents=europe",
                [],
                "/boards"
            )
        );
        assert.match(html, /search-results-heading/);
        assert.doesNotMatch(html, /FEATURED BOARDS/);
        const cleanups = effects.map((effect) => effect());
        t.mock.timers.tick(221);
        await new Promise<void>((resolve) => setImmediate(resolve));
        const results = requests.find((url) => url.pathname.endsWith("/boards/search"))!;
        assert.ok(results);
        assert.equal(results.searchParams.get("q"), query);
        assert.equal(results.searchParams.get("page"), "2");
        for (const url of requests) {
            assert.deepEqual(url.searchParams.getAll("countries"), ["BGD", "FRA"]);
            assert.deepEqual(url.searchParams.getAll("continents"), ["europe"]);
            assert.equal(url.searchParams.get("location"), "off");
        }
        assert.equal(
            requests.some((url) => url.pathname.endsWith("/suggestions")),
            Boolean(query)
        );
        cleanups.forEach((cleanup) => {
            if (typeof cleanup === "function") cleanup();
        });
    }
});
