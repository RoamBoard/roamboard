import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React from "react";
import BoardEditorRail from "../src/components/features/boards/BoardEditorRail";

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
        window: browser,
        document: doc,
        getComputedStyle: (surface: Surface) => ({ overflowY: surface.overflowY, overflowX: surface.overflowX })
    })) {
        previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, { configurable: true, value });
    }
    BoardEditorRail({ children: null });
    const cleanups = effects.map((effect) => effect());
    context.after(() => {
        cleanups.forEach((cleanup) => cleanup?.());
        previous.forEach((descriptor, key) => {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        });
    });
    function wheel(changes: Record<string, unknown> = {}) {
        const state = { prevented: false };
        const handler = rail.listeners.get("wheel");
        assert.ok(handler);
        handler({
            target,
            deltaY: 90,
            deltaX: 0,
            ctrlKey: false,
            metaKey: false,
            shiftKey: false,
            preventDefault: () => {
                state.prevented = true;
            },
            ...changes
        } as never);
        return state.prevented;
    }
    return { rail, target, wheel };
}

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
