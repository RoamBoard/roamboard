import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DestinationRail } from "../src/components/features/destinations/DestinationRail";

type Box = { left: number; right: number };
// Minimal DOM surfaces exercise the production rail's registered wheel/key/focus handlers.
// Returning an unprevented event proves native ownership; actual browser scrolling,
// touch momentum, focus positioning and CSS geometry require Chrome verification.
class Surface {
    parentElement: Surface | null = null;
    scrollTop = 0;
    scrollHeight = 400;
    clientHeight = 400;
    scrollLeft = 0;
    scrollWidth = 400;
    clientWidth = 400;
    overflowY = "visible";
    overflowX = "visible";
    bounds: Box = { left: 0, right: 400 };
    listeners = new Map<string, (event: unknown) => void>();
    scrolls: ScrollToOptions[] = [];
    constructor(
        public tagName = "DIV",
        public attributes: Record<string, string> = {}
    ) {}
    append(child: Surface) {
        child.parentElement = this;
        return child;
    }
    matches(selector: string): boolean {
        return selector.split(",").some((part) => {
            const value = part.trim();
            if (value.startsWith(".")) return (this.attributes.class ?? "").split(" ").includes(value.slice(1));
            const attribute = /^\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]$/.exec(value);
            if (attribute)
                return (
                    attribute[1] in this.attributes && (!attribute[2] || this.attributes[attribute[1]] === attribute[2])
                );
            return value.toUpperCase() === this.tagName;
        });
    }
    closest(selector: string): Surface | null {
        for (const node of this.ancestors()) if (node.matches(selector)) return node;
        return null;
    }
    *ancestors(): Generator<Surface> {
        yield this;
        if (this.parentElement) yield* this.parentElement.ancestors();
    }
    contains(target: Surface) {
        return [...target.ancestors()].includes(this);
    }
    getBoundingClientRect() {
        return this.bounds;
    }
    addEventListener(type: string, listener: (event: unknown) => void) {
        this.listeners.set(type, listener);
    }
    removeEventListener(type: string) {
        this.listeners.delete(type);
    }
    scrollTo(options: ScrollToOptions) {
        this.scrolls.push(options);
        if (options.left !== undefined) this.scrollLeft = options.left;
        if (options.top !== undefined) this.scrollTop = options.top;
    }
}
type Node = React.ReactElement<Record<string, unknown>>;
function nodes(root: ReactNode): Node[] {
    if (!isValidElement<Record<string, unknown>>(root)) return [];
    return [root, ...Children.toArray(root.props.children as ReactNode).flatMap(nodes)];
}
function harness(t: TestContext, reduced = false) {
    t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
    const viewport = new Surface();
    viewport.scrollWidth = 1600;
    viewport.overflowX = "auto";
    const chapter = viewport.append(new Surface("SECTION", { "data-destination-chapter": "" }));
    const inner = chapter.append(new Surface());
    inner.overflowY = "auto";
    inner.scrollHeight = 800;
    const target = inner.append(new Surface("P"));
    const previous = new Map<string, PropertyDescriptor | undefined>();
    const browser = Object.assign(new EventTarget(), {
        location: { hash: "" },
        setTimeout: globalThis.setTimeout,
        clearTimeout: globalThis.clearTimeout,
        getComputedStyle: (element: Surface) => ({ overflowY: element.overflowY, overflowX: element.overflowX })
    });
    for (const [key, value] of Object.entries({
        window: browser,
        document: { getElementById: () => null },
        Element: Surface,
        HTMLElement: Surface,
        getComputedStyle: browser.getComputedStyle
    })) {
        previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, { configurable: true, value });
    }
    const effects: Array<() => void | (() => void)> = [];
    const original = { useRef: React.useRef, useState: React.useState, useEffect: React.useEffect };
    const capture: { tree: ReactNode } = { tree: null };
    function Probe() {
        React.useRef = (() => ({ current: viewport })) as typeof React.useRef;
        React.useState = (() => [reduced, () => {}]) as unknown as typeof React.useState;
        React.useEffect = (effect) => {
            effects.push(effect);
        };
        try {
            capture.tree = DestinationRail({ name: "Stockholm", children: null });
        } finally {
            Object.assign(React, original);
        }
        return null;
    }
    renderToStaticMarkup(createElement(Probe));
    const cleanups = effects.map((effect) => effect());
    t.after(() => {
        cleanups.forEach((cleanup) => cleanup?.());
        previous.forEach((descriptor, key) => {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        });
    });
    const rail = nodes(capture.tree).find((node) => node.props.role === "region");
    assert.ok(rail);
    function wheel(changes: Record<string, unknown> = {}) {
        const state = { prevented: false };
        const listener = viewport.listeners.get("wheel");
        assert.ok(listener);
        listener({
            target,
            deltaX: 0,
            deltaY: 80,
            deltaMode: 0,
            ctrlKey: false,
            metaKey: false,
            preventDefault() {
                state.prevented = true;
            },
            ...changes
        });
        return state;
    }
    function key(key: string, changes: Record<string, unknown> = {}) {
        assert.ok(rail);
        const state = { prevented: false };
        (rail.props.onKeyDown as (event: unknown) => void)({
            key,
            target,
            currentTarget: viewport,
            ctrlKey: false,
            altKey: false,
            metaKey: false,
            shiftKey: false,
            preventDefault() {
                state.prevented = true;
            },
            ...changes
        });
        return state;
    }
    return { viewport, chapter, inner, target, wheel, key, rail, quiet: () => t.mock.timers.tick(1000) };
}
test("vertical wheel stays native while an information panel can scroll and changes chapters only at directional boundaries", (t) => {
    const view = harness(t);
    assert.equal(view.wheel().prevented, false);
    assert.equal(view.viewport.scrolls.length, 0);
    view.inner.scrollTop = 200;
    assert.equal(view.wheel({ deltaY: -80 }).prevented, false);
    assert.equal(view.viewport.scrolls.length, 0);
    view.inner.scrollTop = 400;
    view.quiet();
    assert.equal(view.wheel().prevented, true);
    assert.equal(view.viewport.scrolls.at(-1)?.left, 400);
    view.quiet();
    view.inner.scrollTop = 0;
    assert.equal(view.wheel({ deltaY: -80 }).prevented, true);
    assert.equal(view.viewport.scrolls.at(-1)?.left, 0);
});
test("nested inner scroller at its edge delegates to an overflowing chapter before advancing the rail", (t) => {
    const view = harness(t);
    view.inner.scrollTop = 400;
    view.chapter.overflowY = "auto";
    view.chapter.scrollHeight = 700;
    assert.equal(view.wheel().prevented, false);
    assert.equal(view.viewport.scrolls.length, 0);
    view.chapter.scrollTop = 300;
    view.quiet();
    assert.equal(view.wheel().prevented, true);
    assert.equal(view.viewport.scrolls.at(-1)?.left, 400);
});
test("horizontal galleries, map zoom and modified gestures retain independent wheel ownership", (t) => {
    const view = harness(t);
    const gallery = view.chapter.append(new Surface("DIV", { "data-destination-scroll": "" }));
    gallery.scrollWidth = 1000;
    const card = gallery.append(new Surface("ARTICLE"));
    assert.equal(view.wheel({ target: card, deltaX: 80, deltaY: 1 }).prevented, true);
    assert.equal(gallery.scrollLeft, 80);
    assert.equal(view.viewport.scrolls.length, 0);
    gallery.scrollLeft = 600;
    view.quiet();
    view.wheel({ target: card, deltaX: 80, deltaY: 1 });
    assert.equal(view.viewport.scrolls.at(-1)?.left, 400);
    const map = view.chapter.append(new Surface("DIV", { class: "mapboxgl-map" }));
    for (const event of [{ target: map }, { ctrlKey: true }, { metaKey: true }]) {
        const before: number = view.viewport.scrolls.length;
        assert.equal(view.wheel(event).prevented, false);
        assert.equal(view.viewport.scrolls.length, before);
    }
});
test("vertical keys reach lower controls before chapter navigation and preserve native control keys", (t) => {
    const view = harness(t);
    for (const key of ["ArrowDown", "PageDown", " ", "End"])
        assert.equal(view.key(key).prevented, false, `${key} must remain available to the inner scroller`);
    assert.equal(view.viewport.scrolls.length, 0);
    view.inner.scrollTop = 400;
    for (const key of ["ArrowUp", "PageUp", "Home"]) assert.equal(view.key(key).prevented, false);
    assert.equal(view.key(" ", { shiftKey: true }).prevented, false);
    const button = view.inner.append(new Surface("BUTTON"));
    assert.equal(view.key(" ", { target: button }).prevented, false);
    const gallery = view.chapter.append(new Surface("DIV", { "data-destination-scroll": "" }));
    for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"])
        assert.equal(view.key(key, { target: gallery }).prevented, false);
    assert.equal(view.viewport.scrolls.length, 0);
    assert.equal(view.key("PageDown").prevented, true);
    assert.equal(view.viewport.scrolls.at(-1)?.left, 400);
});
test("focus reveals offscreen chapters and reduced motion keeps explicit navigation instantaneous", (t) => {
    const view = harness(t, true);
    view.chapter.bounds = { left: 800, right: 1200 };
    const control = view.inner.append(new Surface("BUTTON"));
    (view.rail.props.onFocusCapture as (event: unknown) => void)({ target: control, currentTarget: view.viewport });
    assert.deepEqual(view.viewport.scrolls.at(-1), { left: 800, behavior: "instant" });
    view.inner.scrollTop = 400;
    view.quiet();
    view.wheel();
    assert.equal(view.viewport.scrolls.at(-1)?.behavior, "instant");
});

test("momentum arriving at an inner edge cannot fling into another chapter until the user pauses", (t) => {
    const view = harness(t);
    view.inner.scrollTop = 390;
    assert.equal(view.wheel().prevented, false);
    view.inner.scrollTop = 400;
    t.mock.timers.tick(30);
    view.wheel({ deltaY: 15 });
    assert.equal(view.viewport.scrolls.length, 0);
    t.mock.timers.tick(30);
    view.wheel({ deltaY: 5 });
    assert.equal(view.viewport.scrolls.length, 0);
    view.quiet();
    view.wheel();
    assert.equal(view.viewport.scrolls.at(-1)?.left, 400);
});

test("native disclosure, form, map and already-handled keyboard events are not intercepted", (t) => {
    const view = harness(t);
    for (const tag of ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "SUMMARY", "A"]) {
        const control = view.inner.append(new Surface(tag));
        assert.equal(view.key(" ", { target: control }).prevented, false);
    }
    const slider = view.chapter.append(new Surface("DIV", { role: "slider" }));
    const map = view.chapter.append(new Surface("DIV", { class: "mapboxgl-map" }));
    for (const target of [slider, map]) assert.equal(view.key("ArrowRight", { target }).prevented, false);
    for (const flag of ["ctrlKey", "altKey", "metaKey", "defaultPrevented"])
        assert.equal(view.key("ArrowRight", { [flag]: true }).prevented, false);
    assert.equal(view.viewport.scrolls.length, 0);
});
