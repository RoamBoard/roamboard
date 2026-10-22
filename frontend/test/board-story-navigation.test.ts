import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React from "react";
import useStoryScroll from "../src/components/features/boards/useStoryScroll";
import ScrollCue from "../src/components/ui/ScrollCue";

class Surface {
    parentElement: Surface | null = null;
    listeners = new Map<string, (event: never) => void>();
    style = { height: "", scrollSnapType: "", setProperty() {}, removeProperty() {} };
    scrollLeft = 0;
    scrollTop = 0;
    scrollHeight = 700;
    clientHeight = 700;
    clientWidth = 800;
    offsetLeft = 0;
    overflowY = "visible";
    kind = "";
    dataset: Record<string, string> = {};
    documentTop = 62;
    focused = false;
    scrolls: number[] = [];
    smoothTarget?: number;
    scrollBehaviors: Array<string | undefined> = [];
    constructor(public id: string) {}
    addEventListener(name: string, listener: (event: never) => void) {
        this.listeners.set(name, listener);
    }
    removeEventListener(name: string) {
        this.listeners.delete(name);
    }
    getBoundingClientRect() {
        const height = Number.parseFloat(this.style.height) || this.clientHeight;
        return { top: this.documentTop - window.scrollY, bottom: this.documentTop + height - window.scrollY };
    }
    closest(selector: string): Surface | null {
        if (
            (this.kind === "map" && selector.includes(".mapboxgl-map")) ||
            (this.dataset.storyMapExpanded === "true" && selector.includes("data-story-map-expanded")) ||
            (this.kind === "button" && selector.includes("button")) ||
            (this.kind === "link" && /\ba(?:\[|\b)/.test(selector)) ||
            (selector.includes("[data-story-scene]") && (this.id === "overview" || this.id.startsWith("day-")))
        )
            return this;
        return this.parentElement?.closest(selector) ?? null;
    }
    scrollTo({ left, behavior }: { left: number; behavior?: string }) {
        if (behavior === "smooth") this.smoothTarget = left;
        else this.scrollLeft = left;
        this.scrolls.push(left);
        this.scrollBehaviors.push(behavior);
    }
    scrollIntoView() {
        this.scrolls.push(-1);
        window.scrollTo({ top: this.documentTop });
    }
    focus() {
        this.focused = true;
    }
}

function mount(context: TestContext, desktop = true) {
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
    ending.documentTop = 62 + scenes.length * viewport.clientHeight;
    const comments = new Surface("comments");
    comments.documentTop = ending.documentTop + 1400;
    const states: unknown[] = [];
    const dispatched: string[] = [];
    const observerCallback = { resize: () => {} };
    Object.assign(rail, { querySelectorAll: () => scenes, contains: (element: Surface) => scenes.includes(element) });
    const timers = new Map<number, () => void>();
    const windowListeners = new Map<string, Set<(event?: unknown) => void>>();
    const verticalScrolls: number[] = [];
    const verticalBehaviors: Array<string | undefined> = [];
    const win = {
        innerHeight: 800,
        dispatchEvent(event: Event) {
            dispatched.push(event.type);
            return true;
        },
        scrollY: 0,
        location: { hash: "" },
        history: {
            state: null,
            pushState(_state: unknown, _title: string, hash: string) {
                win.location.hash = hash;
            }
        },
        matchMedia: (query: string) => ({ matches: !query.includes("reduced-motion") && desktop }),
        scrollTo({ top, behavior }: { top: number; behavior?: string }) {
            verticalScrolls.push(top);
            verticalBehaviors.push(behavior);
            win.scrollY = top;
            windowListeners.get("scroll")?.forEach((listener) => listener());
        },
        addEventListener(name: string, listener: () => void) {
            if (!windowListeners.has(name)) windowListeners.set(name, new Set());
            windowListeners.get(name)!.add(listener);
        },
        removeEventListener(name: string, listener: () => void) {
            windowListeners.get(name)?.delete(listener);
        },
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
    install("document", {
        getElementById: (id: string) => [...scenes, ending, comments].find((scene) => scene.id === id),
        addEventListener: win.addEventListener,
        removeEventListener: win.removeEventListener,
        querySelector: (selector: string) => target.closest(selector),
        documentElement: { scrollHeight: comments.documentTop + 1400 },
        body: { scrollHeight: comments.documentTop + 1400 }
    });
    install("Element", Surface);
    install("HTMLElement", Surface);
    install("getComputedStyle", (element: Surface) => ({ overflowY: element.overflowY }));
    install(
        "ResizeObserver",
        class {
            constructor(callback: () => void) {
                observerCallback.resize = callback;
            }
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
    React.useState = ((initial?: unknown) => [
        initial,
        (value: unknown) => states.push(value)
    ]) as typeof React.useState;
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
        const global = windowListeners.get("wheel");
        if (global?.size) global.forEach((listener) => listener(event));
        else track.listeners.get("wheel")?.(event as never);
        return event;
    };
    const settle = () => {
        for (const callback of timers.values()) callback();
        timers.clear();
    };
    const nativeScroll = (top: number) => {
        win.scrollY = top;
        windowListeners.get("scroll")?.forEach((listener) => listener());
    };
    const nativeScrollEnd = () => windowListeners.get("scrollend")?.forEach((listener) => listener());
    const horizontalProgress = (left: number) => {
        viewport.scrollLeft = left;
        viewport.listeners.get("scroll")?.({} as never);
    };
    const horizontalEnd = () => {
        horizontalProgress(viewport.smoothTarget ?? viewport.scrollLeft);
        viewport.smoothTarget = undefined;
        viewport.listeners.get("scrollend")?.({} as never);
    };
    return {
        track,
        viewport,
        scenes,
        target,
        ending,
        result,
        wheel,
        settle,
        win,
        nativeScroll,
        nativeScrollEnd,
        horizontalProgress,
        horizontalEnd,
        verticalScrolls,
        verticalBehaviors,
        rail,
        comments,
        states,
        dispatched,
        resize: () => observerCallback.resize()
    };
}

test("wheel snaps align the native vertical runway and step into the ending after the last scene", (context) => {
    const app = mount(context);
    assert.equal(app.wheel(500).prevented, true);
    assert.equal(
        app.viewport.scrollBehaviors.at(-1),
        "smooth",
        "Wheel navigation uses the native horizontal smooth surface"
    );
    assert.equal(app.win.scrollY, 0, "The runway commits only when horizontal navigation completes");
    app.horizontalProgress(360);
    app.nativeScroll(0);
    assert.equal(
        app.viewport.scrollLeft,
        360,
        "Window scroll updates must not overwrite an in-flight native horizontal animation"
    );
    app.horizontalEnd();
    assert.equal(app.win.scrollY, 700);
    assert.equal(app.viewport.scrollLeft, 800);
    app.wheel(200);
    assert.equal(app.win.scrollY, 700, "Momentum must not skip the next scene");
    app.settle();
    app.wheel(500);
    app.horizontalEnd();
    assert.equal(app.win.scrollY, 1400);
    assert.equal(app.viewport.scrollLeft, 1600);
    app.settle();
    assert.equal(app.wheel(500).prevented, true);
    assert.ok(app.win.scrollY > 1400, "The final scene advances into the vertical ending");
    app.nativeScroll(1550);
    assert.equal(app.viewport.scrollLeft, 1600);
    app.settle();
    app.wheel(-500, app.target, { deltaX: -500, deltaY: 0 });
    app.horizontalEnd();
    assert.equal(app.viewport.scrollLeft, 1600);
    assert.equal(app.win.scrollY, 1400, "Upward navigation from a partial ending returns to the final scene first");
});

test("native horizontal chapter animations settle symmetrically forward and backward without runway interference", (context) => {
    const app = mount(context);
    for (const index of [2, 1, 0, 1, 2, 0]) {
        const before = app.viewport.scrollLeft;
        app.result.jump(app.scenes[index].id);
        assert.equal(app.viewport.scrollBehaviors.at(-1), "smooth");
        assert.equal(app.viewport.smoothTarget, index * 800);
        const halfway = (before + index * 800) / 2;
        app.horizontalProgress(halfway);
        app.nativeScroll(app.win.scrollY);
        app.nativeScrollEnd();
        assert.equal(
            app.viewport.scrollLeft,
            halfway,
            "Neither window scroll nor its scrollend may interrupt horizontal travel"
        );
        app.horizontalEnd();
        assert.equal(app.viewport.scrollLeft, index * 800);
        assert.equal(app.win.scrollY, index * 700);
    }
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
    app.horizontalEnd();
    assert.equal(app.viewport.scrollLeft, 800);
    assert.equal(app.win.location.hash, "#day-1");
    assert.equal(app.win.scrollY, 700);
    assert.equal(app.scenes[1].focused, true);
    app.result.jump("day-1-part-2");
    app.horizontalEnd();
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
    app.horizontalEnd();
    assert.equal(app.viewport.scrollLeft, 800);
    assert.equal(press("ArrowUp").prevented, true);
    app.horizontalEnd();
    assert.equal(app.viewport.scrollLeft, 0);
    app.target.overflowY = "auto";
    app.target.scrollHeight = 1400;
    assert.equal(press("ArrowDown").prevented, false);
    assert.equal(app.viewport.scrollLeft, 0);
});

test("desktop story surfaces preserve native middle-button autoscroll and middle-click links", (context) => {
    const app = mount(context);
    const press = (button: number, target = app.target) => {
        const event = {
            button,
            target,
            prevented: false,
            preventDefault() {
                this.prevented = true;
            }
        };
        app.track.listeners.get("mousedown")?.(event as never);
        return event;
    };
    assert.equal(press(1).prevented, false);
    assert.equal(press(0).prevented, false);
    assert.equal(press(2).prevented, false);
    app.target.kind = "link";
    assert.equal(press(1).prevented, false, "Middle-clicking a link must still open it in a new tab");
    const icon = new Surface("link-icon");
    icon.parentElement = app.target;
    assert.equal(press(1, icon).prevented, false, "A link's nested image or icon keeps the native middle-click action");
    assert.deepEqual(app.viewport.scrolls, []);
});

test("native partial scrolling continuously synchronizes horizontal progress without moving the sticky stage off its runway", (context) => {
    const app = mount(context);
    assert.equal(app.track.style.height, "2100px");
    for (const [top, left] of [
        [0, 0],
        [350, 400],
        [700, 800],
        [1050, 1200],
        [1400, 1600],
        [1650, 1600]
    ]) {
        app.nativeScroll(top);
        assert.equal(app.viewport.scrollLeft, left);
        assert.equal(
            app.viewport.style.scrollSnapType,
            left % 800 ? "none" : "x mandatory",
            "Fractional native page travel must not be preempted by horizontal CSS snapping"
        );
    }
    app.result.jump("day-1");
    app.horizontalEnd();
    assert.equal(app.win.scrollY, 700);
    assert.equal(app.viewport.scrollLeft, 800);
});

test("keyboard focus entering another scene synchronizes its vertical and horizontal position", (context) => {
    const app = mount(context);
    const target = new Surface("photo-link");
    target.kind = "link";
    target.parentElement = app.scenes[2];
    app.rail.listeners.get("focusin")?.({ target } as never);
    app.horizontalEnd();
    assert.equal(app.win.scrollY, 1400);
    assert.equal(app.viewport.scrollLeft, 1600);
});

test("native and middle-button scrolling settle to the nearest scene only inside the horizontal runway", (context) => {
    const app = mount(context);
    for (const [partial, snapped] of [
        [110, 0],
        [970, 700],
        [1130, 1400]
    ]) {
        app.nativeScroll(partial);
        app.nativeScrollEnd();
        app.horizontalEnd();
        assert.equal(app.win.scrollY, snapped);
        assert.equal(app.viewport.scrollLeft, (snapped / 700) * 800);
        const completed = app.verticalScrolls.length;
        app.nativeScrollEnd();
        assert.equal(app.verticalScrolls.length, completed, "Already aligned scenes must not restart settling");
    }
});

test("a fractional native horizontal stop finishes at the nearest snap target before committing the vertical runway", (context) => {
    const app = mount(context);
    app.horizontalProgress(1070);
    app.viewport.listeners.get("scrollend")?.({} as never);
    assert.equal(app.viewport.smoothTarget, 800);
    assert.equal(app.viewport.scrollLeft, 1070, "The fractional position keeps animating on the horizontal surface");
    assert.equal(app.win.scrollY, 0, "Vertical synchronization waits for an aligned horizontal target");
    app.horizontalEnd();
    assert.equal(app.viewport.scrollLeft, 800);
    assert.equal(app.win.scrollY, 700);
    assert.equal(app.viewport.style.scrollSnapType, "x mandatory");
});

test("Summary and Comments retain native vertical wheel scrolling in both directions", (context) => {
    const app = mount(context);
    const text = new Surface("ending-text");
    text.parentElement = app.ending;
    for (const position of [app.ending.documentTop + 350, app.comments.documentTop + 350]) {
        app.nativeScroll(position);
        const before = app.verticalScrolls.length;
        assert.equal(app.wheel(900, text).prevented, false);
        assert.equal(app.wheel(-900, text).prevented, false);
        assert.equal(app.verticalScrolls.length, before);
    }
});

test("returning from the ending to the already aligned final scene animates vertically", (context) => {
    const app = mount(context);
    app.result.jump("day-1-part-2");
    app.horizontalEnd();
    app.nativeScroll(app.ending.documentTop + 350);
    app.result.jump("day-1-part-2");
    assert.equal(app.viewport.scrollLeft, 1600);
    assert.equal(app.win.scrollY, 1400);
    assert.equal(app.verticalBehaviors.at(-1), "smooth");
});

test("upward wheel at the ending boundary returns smoothly to the final scene", (context) => {
    const app = mount(context);
    app.result.jump("day-1-part-2");
    app.horizontalEnd();
    app.nativeScroll(app.ending.documentTop - 62);
    assert.equal(app.wheel(-500).prevented, true);
    assert.equal(app.win.scrollY, 1400);
    assert.equal(app.verticalBehaviors.at(-1), "smooth");
});

test("Enter and Space on native links and buttons keep their normal activation behavior", (context) => {
    const app = mount(context);
    for (const kind of ["link", "button"])
        for (const key of ["Enter", " "]) {
            app.target.kind = kind;
            const event = {
                key,
                target: app.target,
                prevented: false,
                preventDefault() {
                    this.prevented = true;
                }
            };
            app.track.listeners.get("keydown")?.(event as never);
            assert.equal(event.prevented, false);
        }
    assert.deepEqual(app.verticalScrolls, []);
});

test("the circular next-arrow control activates with Space without vertical page drift and preserves native Enter", (context) => {
    const app = mount(context);
    const cue = ScrollCue({
        targetId: "day-1",
        direction: "right",
        lines: false,
        onClick: (event) => {
            event.preventDefault();
            app.result.jump("day-1");
        }
    });
    const press = (key: string) => {
        const event = {
            key,
            ctrlKey: false,
            metaKey: false,
            altKey: false,
            shiftKey: false,
            prevented: false,
            preventDefault() {
                this.prevented = true;
            },
            currentTarget: {
                click() {
                    cue.props.onClick?.({ preventDefault() {} } as never);
                }
            }
        };
        cue.props.onKeyDown(event as never);
        return event;
    };
    assert.equal(cue.props.href, "#day-1");
    assert.equal(press(" ").prevented, true);
    app.horizontalEnd();
    assert.equal(app.win.scrollY, 700);
    assert.equal(app.viewport.scrollLeft, 800);
    assert.equal(app.scenes[1].focused, true);
    assert.equal(press("Enter").prevented, false, "Enter retains the anchor's native activation");
});

test("middle-button gestures outside desktop story navigation retain native behavior", (context) => {
    const app = mount(context, false);
    const event = {
        button: 1,
        target: app.target,
        prevented: false,
        preventDefault() {
            this.prevented = true;
        }
    };
    app.track.listeners.get("mousedown")?.(event as never);
    assert.equal(event.prevented, false);
    assert.deepEqual(app.viewport.scrolls, []);
});

test("rapid horizontal and vertical wheel bursts stay captured while a scene travels", (context) => {
    const app = mount(context);
    for (const index of Array.from({ length: 40 }, (_, index) => index)) {
        assert.equal(app.wheel(1800, app.target, index % 2 ? { deltaX: 2000, deltaY: 0 } : {}).prevented, true);
        app.horizontalProgress(100 + index);
    }
    assert.equal(app.viewport.smoothTarget, 800, "A burst cannot bypass the next scene");
    app.horizontalEnd();
    assert.equal(app.viewport.scrollLeft, 800);
});

test("wheel on an expanded map collapses it and advances the story", (context) => {
    const app = mount(context);
    app.target.kind = "map";
    app.target.dataset.storyMapExpanded = "true";
    assert.equal(app.wheel(500).prevented, true);
    assert.ok(app.dispatched.includes("story-map-collapse"));
    app.horizontalEnd();
    assert.equal(app.viewport.scrollLeft, 800);
});

test("resizing keeps the selected scene aligned instead of exposing adjacent scenes", (context) => {
    const app = mount(context);
    app.result.jump("day-1");
    app.horizontalEnd();
    app.viewport.clientWidth = 1100;
    app.viewport.clientHeight = 900;
    app.scenes.forEach((scene, index) => {
        scene.offsetLeft = index * 1100;
    });
    app.resize();
    assert.equal(app.viewport.scrollLeft, 1100);
    assert.equal(app.win.scrollY, 900);
});

test("comments links and scrolling select the Comments chapter", (context) => {
    const app = mount(context);
    app.result.jump("comments");
    assert.equal(app.states.at(-1), "comments");
    app.nativeScroll(app.comments.documentTop);
    assert.equal(app.states.at(-1), "comments");
});
