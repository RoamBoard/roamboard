import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BoardEditorRail from "../src/components/features/boards/BoardEditorRail";
import BoardPhotoStrip from "../src/components/features/boards/BoardPhotoStrip";
import type { CarouselApi } from "../src/components/ui/carousel";

// Small DOM doubles exercise the registered production handlers; browser layout still needs visual QA.
class Surface {
    parentElement: Surface | null = null;
    listeners = new Map<string, (event: never) => void>();
    scrollLeft = 0;
    scrollTop = 0;
    scrollHeight = 500;
    clientHeight = 500;
    scrollWidth = 800;
    clientWidth = 800;
    offsetLeft = 0;
    overflowY = "visible";
    overflowX = "visible";
    kind = "";
    scrolls: ScrollToOptions[] = [];
    sections: Surface[] = [];
    addEventListener(name: string, listener: (event: never) => void) {
        this.listeners.set(name, listener);
    }
    removeEventListener(name: string) {
        this.listeners.delete(name);
    }
    closest(selector: string): Surface | null {
        if (selector === "[data-editor-section]" && this.kind === "section") return this;
        if (this.kind === "dialog" && selector.includes('[role="dialog"]')) return this;
        if (this.kind === "map" && selector.includes('[data-map-interactive="true"]')) return this;
        if (this.kind === "input" && selector.includes("input")) return this;
        return this.parentElement?.closest(selector) ?? null;
    }
    querySelectorAll() {
        return this.sections;
    }
    scrollTo(options: ScrollToOptions) {
        this.scrolls.push(options);
        this.scrollLeft = options.left ?? this.scrollLeft;
    }
}

function mount(context: TestContext, desktop = true, reduced = false) {
    const rail = new Surface();
    rail.sections = Array.from({ length: 5 }, (_, index) => {
        const section = new Surface();
        section.kind = "section";
        section.offsetLeft = index * rail.clientWidth;
        section.parentElement = rail;
        return section;
    });
    const target = new Surface();
    target.parentElement = rail.sections[0];
    const effects: Array<() => void | (() => void)> = [];
    context.mock.method(React, "useRef", () => ({ current: rail }));
    context.mock.method(React, "useEffect", (effect: () => void | (() => void)) => effects.push(effect));
    const previous = new Map<string, PropertyDescriptor | undefined>();
    const browser = Object.assign(new EventTarget(), {
        location: { hash: "" },
        matchMedia: (query: string) => ({ matches: query.includes("reduced-motion") ? reduced : desktop })
    });
    const doc = Object.assign(new EventTarget(), { getElementById: () => null });
    for (const [key, value] of Object.entries({
        Element: Surface,
        HTMLElement: Surface,
        ResizeObserver: class {
            observe() {}
            disconnect() {}
        },
        window: browser,
        document: doc,
        getComputedStyle: (surface: Surface) => ({ overflowY: surface.overflowY, overflowX: surface.overflowX })
    })) {
        previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, { configurable: true, value });
    }
    renderToStaticMarkup(React.createElement(BoardEditorRail, undefined, null));
    const cleanups = effects.map((effect) => effect());
    context.after(() => {
        cleanups.forEach((cleanup) => cleanup?.());
        previous.forEach((descriptor, key) => {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        });
    });
    function wheel(changes: Record<string, unknown> = {}, inner?: Surface) {
        const handler = rail.listeners.get("wheel");
        assert.ok(handler);
        const event = {
            defaultPrevented: false,
            target,
            deltaY: 90,
            deltaX: 0,
            ctrlKey: false,
            metaKey: false,
            shiftKey: false,
            preventDefault() {
                event.defaultPrevented = true;
            },
            ...changes
        };
        inner?.listeners.get("wheel")?.(event as never);
        handler(event as never);
        return event.defaultPrevented;
    }
    return { rail, target, wheel };
}

function mountStrip(context: TestContext, target: Surface, progress = 0.5, length = 1000) {
    const viewport = new Surface();
    viewport.overflowX = "hidden";
    viewport.parentElement = target.parentElement;
    target.parentElement = viewport;
    const position = { value: -progress * length };
    const body = { useBaseFriction: () => body, useDuration: () => body };
    const api = {
        rootNode: () => viewport,
        scrollProgress: () => (length ? -position.value / length : 0),
        internalEngine: () => ({
            limit: { max: 0, length },
            target: { get: () => position.value },
            scrollBody: body,
            scrollTo: { distance: (delta: number) => (position.value += delta) }
        }),
        on: () => api,
        off: () => api
    } as unknown as CarouselApi;
    const effects: Array<() => void | (() => void)> = [];
    context.mock.method(React, "useState", ((initial?: unknown) => [
        initial ?? api,
        () => {}
    ]) as typeof React.useState);
    context.mock.method(React, "useEffect", (effect: () => void | (() => void)) => effects.push(effect));
    function Probe() {
        BoardPhotoStrip({ label: "Board day plans", days: true, children: null });
        return null;
    }
    renderToStaticMarkup(React.createElement(Probe));
    const cleanups = effects.map((effect) => effect());
    context.after(() => cleanups.forEach((cleanup) => cleanup?.()));
    return { viewport, position };
}

for (const [label, changes, movement] of [
    ["horizontal", { deltaX: 90, deltaY: 0 }, -90],
    ["Shift-wheel", { deltaX: 0, deltaY: 90, shiftKey: true }, -90],
    ["backward", { deltaX: -90, deltaY: 0 }, 90]
] as const) {
    test(`${label} wheel browses Embla days without changing chapters`, (context) => {
        const { rail, target, wheel } = mount(context);
        const { viewport, position } = mountStrip(context, target);
        assert.equal(wheel(changes, viewport), true);
        assert.ok(Math.abs(position.value - (-500 + movement)) < 0.001);
        assert.deepEqual(rail.scrolls, []);
    });
}

test("reaching the final day does not carry wheel momentum into another chapter, but a new gesture can", (context) => {
    const clock = { now: 1000 };
    context.mock.method(Date, "now", () => clock.now);
    const { rail, target, wheel } = mount(context);
    const { viewport, position } = mountStrip(context, target, 0.95);
    const gesture = { deltaX: 90, deltaY: 0 };
    wheel(gesture, viewport);
    assert.equal(position.value, -1000);
    clock.now += 50;
    wheel(gesture, viewport);
    assert.deepEqual(rail.scrolls, []);
    clock.now += 200;
    wheel(gesture, viewport);
    assert.deepEqual(rail.scrolls, [{ left: 800, behavior: "smooth" }]);
});

test("the day carousel leaves mobile scrolling alone", (context) => {
    const { rail, target, wheel } = mount(context, false);
    const { viewport, position } = mountStrip(context, target);
    assert.equal(wheel({ deltaX: 90, deltaY: 0 }, viewport), false);
    assert.equal(position.value, -500);
    assert.deepEqual(rail.scrolls, []);
});

test("a day strip without overflow lets the rail handle horizontal wheel navigation", (context) => {
    const { rail, target, wheel } = mount(context);
    const { viewport } = mountStrip(context, target, 0, 0);
    wheel({ deltaX: 90, deltaY: 0 }, viewport);
    assert.equal(rail.scrolls.length, 1);
});

test("browser zoom and vertical wheel gestures are not consumed by the Embla day strip", (context) => {
    const { rail, target, wheel } = mount(context);
    const { viewport, position } = mountStrip(context, target);
    assert.equal(wheel({ deltaX: 90, deltaY: 0, ctrlKey: true }, viewport), false);
    assert.equal(wheel({ deltaX: 90, deltaY: 0, metaKey: true }, viewport), false);
    assert.equal(position.value, -500);
    wheel({ deltaX: 1, deltaY: 90 }, viewport);
    assert.equal(position.value, -500);
    assert.equal(rail.scrolls.length, 1);
});

test("desktop wheel advances one section and reduced motion removes animated travel", (context) => {
    const { rail, wheel } = mount(context, true, true);
    assert.equal(wheel(), true);
    assert.deepEqual(rail.scrolls, [{ left: 800, behavior: "instant" }]);
    wheel();
    assert.equal(rail.scrolls.length, 1, "A continuing gesture must not skip chapters");
});

test("mobile wheel stays native and does not move the editor sideways", (context) => {
    const { rail, wheel } = mount(context, false);
    assert.equal(wheel(), false);
    assert.deepEqual(rail.scrolls, []);
});

test("desktop planner consumes its own vertical content before section navigation", (context) => {
    const { rail, target, wheel } = mount(context);
    const planner = new Surface();
    planner.overflowY = "auto";
    planner.scrollHeight = 1200;
    planner.parentElement = target.parentElement;
    target.parentElement = planner;
    assert.equal(wheel(), false);
    assert.deepEqual(rail.scrolls, []);
    planner.scrollTop = 700;
    assert.equal(wheel(), true);
    assert.deepEqual(rail.scrolls, [], "Finishing an inner scroll must not carry momentum into the next section");
});

test("dialogs, expanded maps, text editing and browser zoom never navigate editor sections", (context) => {
    const { rail, target, wheel } = mount(context);
    for (const kind of ["dialog", "map", "input"]) {
        target.kind = kind;
        assert.equal(wheel(), false, kind);
    }
    target.kind = "";
    assert.equal(wheel({ ctrlKey: true }), false);
    assert.equal(wheel({ metaKey: true }), false);
    assert.deepEqual(rail.scrolls, []);
});
