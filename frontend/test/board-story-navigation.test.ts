import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React from "react";
import useStoryScroll from "../src/components/features/boards/useStoryScroll";

class Surface {
    parentElement: Surface | null = null;
    listeners = new Map<string, (event: never) => void>();
    style = { setProperty() {} };
    scrollLeft = 0;
    scrollTop = 0;
    scrollHeight = 700;
    clientHeight = 700;
    clientWidth = 800;
    offsetLeft = 0;
    overflowY = "visible";
    kind = "";
    scrolls: number[] = [];
    constructor(public id: string) {}
    addEventListener(name: string, listener: (event: never) => void) {
        this.listeners.set(name, listener);
    }
    removeEventListener(name: string) {
        this.listeners.delete(name);
    }
    getBoundingClientRect() {
        return { top: this.id === "ending" ? 900 : 52, bottom: 752 };
    }
    closest(selector: string) {
        return (this.kind === "map" && selector.includes(".mapboxgl-map")) ||
            (this.kind === "button" && selector.includes("button"))
            ? this
            : null;
    }
    scrollTo({ left }: { left: number }) {
        this.scrollLeft = left;
        this.scrolls.push(left);
    }
    scrollIntoView() {
        this.scrolls.push(-1);
    }
    focus() {}
}

function mount(context: TestContext) {
    const track = new Surface("track"),
        viewport = new Surface("viewport"),
        rail = new Surface("rail");
    const scenes = [new Surface("overview"), new Surface("day-1"), new Surface("day-1-part-2")];
    scenes.forEach((scene, index) => {
        scene.offsetLeft = index * 800;
        scene.parentElement = rail;
    });
    viewport.parentElement = track;
    rail.parentElement = viewport;
    const target = new Surface("photo");
    target.parentElement = scenes[0];
    const ending = new Surface("ending");
    Object.assign(rail, { querySelectorAll: () => scenes, contains: (element: Surface) => scenes.includes(element) });
    const timers = new Map<number, () => void>();
    const win = {
        innerHeight: 800,
        scrollY: 0,
        location: { hash: "" },
        history: {
            state: null,
            pushState(_state: unknown, _title: string, hash: string) {
                win.location.hash = hash;
            }
        },
        matchMedia: (query: string) => ({ matches: !query.includes("reduced-motion") }),
        scrollTo() {},
        addEventListener() {},
        removeEventListener() {},
        setTimeout(callback: () => void) {
            const id = timers.size + 1;
            timers.set(id, callback);
            return id;
        },
        clearTimeout(id: number) {
            timers.delete(id);
        }
    };
    const originals = new Map<string, PropertyDescriptor | undefined>();
    const install = (name: string, value: unknown) => {
        originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    };
    install("window", win);
    install("document", { getElementById: (id: string) => [...scenes, ending].find((scene) => scene.id === id) });
    install("Element", Surface);
    install("HTMLElement", Surface);
    install("getComputedStyle", (element: Surface) => ({ overflowY: element.overflowY }));
    install(
        "ResizeObserver",
        class {
            observe() {}
            disconnect() {}
        }
    );
    install("requestAnimationFrame", (callback: () => void) => {
        callback();
        return 1;
    });
    install("cancelAnimationFrame", () => {});
    const hooks = {
        useRef: React.useRef,
        useState: React.useState,
        useEffect: React.useEffect,
        useCallback: React.useCallback,
        useSyncExternalStore: React.useSyncExternalStore
    };
    const refs = [{ current: track }, { current: viewport }, { current: rail }];
    const index = { ref: 0 };
    const effects: Array<() => void | (() => void)> = [];
    React.useRef = ((initial: unknown) => refs[index.ref++] ?? { current: initial }) as typeof React.useRef;
    React.useState = ((initial?: unknown) => [initial, () => {}]) as typeof React.useState;
    React.useEffect = ((effect: () => void | (() => void)) => {
        effects.push(effect);
    }) as typeof React.useEffect;
    React.useCallback = ((callback: unknown) => callback) as typeof React.useCallback;
    React.useSyncExternalStore = ((_subscribe: unknown, snapshot: () => unknown) =>
        snapshot()) as typeof React.useSyncExternalStore;
    const cleanup: Array<() => void> = [];
    context.after(() => {
        cleanup.forEach((callback) => callback());
        Object.assign(React, hooks);
        for (const [name, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else Reflect.deleteProperty(globalThis, name);
        }
    });
    function Probe() {
        return useStoryScroll("1");
    }
    const result = Probe();
    effects.forEach((effect) => {
        const close = effect();
        if (close) cleanup.push(close);
    });
    const wheel = (delta: number, element = target, extra = {}) => {
        const event = {
            target: element,
            deltaX: 0,
            deltaY: delta,
            ctrlKey: false,
            metaKey: false,
            prevented: false,
            preventDefault() {
                this.prevented = true;
            },
            ...extra
        };
        track.listeners.get("wheel")?.(event as never);
        return event;
    };
    const settle = () => {
        for (const callback of timers.values()) callback();
        timers.clear();
    };
    return { track, viewport, scenes, target, ending, result, wheel, settle, win };
}

test("a wheel gesture advances exactly one scene, with a second scene for the same day before the ending", (context) => {
    const app = mount(context);
    assert.equal(app.wheel(500).prevented, true);
    assert.deepEqual(app.viewport.scrolls, [800]);
    app.wheel(200);
    assert.deepEqual(app.viewport.scrolls, [800], "Momentum must not skip the next scene");
    app.settle();
    app.wheel(500);
    assert.deepEqual(app.viewport.scrolls, [800, 1600]);
    app.settle();
    app.wheel(500);
    assert.deepEqual(app.ending.scrolls, [-1]);
    app.settle();
    app.wheel(-500);
    assert.equal(app.viewport.scrollLeft, 800);
});

test("map zoom and browser zoom never advance the story, and an inner itinerary can scroll naturally", (context) => {
    const app = mount(context);
    app.target.kind = "map";
    assert.equal(app.wheel(500).prevented, false);
    assert.deepEqual(app.viewport.scrolls, []);
    app.target.kind = "";
    assert.equal(app.wheel(500, app.target, { ctrlKey: true }).prevented, false);
    app.target.overflowY = "auto";
    app.target.scrollHeight = 1400;
    assert.equal(app.wheel(500).prevented, false);
    assert.deepEqual(app.viewport.scrolls, []);
    app.target.scrollTop = 700;
    app.wheel(500);
    assert.deepEqual(app.viewport.scrolls, [], "A fling leaving an inner panel must not skip a chapter");
});

test("chapter links target the first scene and preserve an addressable URL without losing native focus", (context) => {
    const app = mount(context);
    app.result.jump("day-1");
    assert.equal(app.viewport.scrollLeft, 800);
    assert.equal(app.win.location.hash, "#day-1");
    app.result.jump("day-1-part-2");
    assert.equal(app.viewport.scrollLeft, 1600);
    app.result.jump("ending");
    assert.deepEqual(app.ending.scrolls, [-1]);
});

test("vertical arrow keys navigate sideways scenes while keeping inner activity scrolling", (context) => {
    const app = mount(context);
    const press = (key: string) => {
        const event = {
            key,
            target: app.target,
            prevented: false,
            preventDefault() {
                this.prevented = true;
            }
        };
        app.track.listeners.get("keydown")?.(event as never);
        return event;
    };
    assert.equal(press("ArrowDown").prevented, true);
    assert.equal(app.viewport.scrollLeft, 800);
    assert.equal(press("ArrowUp").prevented, true);
    assert.equal(app.viewport.scrollLeft, 0);
    app.target.overflowY = "auto";
    app.target.scrollHeight = 1400;
    assert.equal(press("ArrowDown").prevented, false);
    assert.equal(app.viewport.scrollLeft, 0);
});
