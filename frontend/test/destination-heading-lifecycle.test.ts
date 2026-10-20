import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DestinationHeading from "../src/components/features/destinations/DestinationHeading";

type Node = React.ReactElement<Record<string, unknown>>;
type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
function nodes(root: ReactNode): Node[] {
    if (!isValidElement<Record<string, unknown>>(root)) return [];
    return [root, ...Children.toArray(root.props.children as ReactNode).flatMap(nodes)];
}
function text(root: ReactNode): string {
    if (typeof root === "string" || typeof root === "number") return String(root);
    if (isValidElement<{ children?: ReactNode }>(root)) return text(root.props.children);
    return Children.toArray(root).map(text).join("");
}
function deferred() {
    const holder: { resolve?: () => void } = {};
    const promise = new Promise<void>((resolve) => {
        holder.resolve = resolve;
    });
    return { promise, resolve: () => holder.resolve!() };
}

// Run the production heading/effect with controlled frame/font measurements.
// Actual font shapes, CSS geometry and first-paint appearance require Chrome.
function harness(t: TestContext, nativeTracking = true) {
    const fontReady = deferred();
    class Fonts extends EventTarget {
        ready = fontReady.promise;
        listeners = new Set<EventListenerOrEventListenerObject>();
        override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
            if (listener) this.listeners.add(listener);
            super.addEventListener(type, listener);
        }
        override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
            if (listener) this.listeners.delete(listener);
            super.removeEventListener(type, listener);
        }
    }
    const fonts = new Fonts();
    const frame = { clientWidth: 240, clientHeight: 160 };
    const label = { offsetHeight: 16 };
    const title = {};
    const metrics = { factor: 1, calls: 0 };
    const raf = new Map<number, FrameRequestCallback>();
    const observations: Observer[] = [];
    class Observer {
        active = false;
        observed: unknown;
        constructor(public callback: () => void) {
            observations.push(this);
        }
        observe(target: unknown) {
            this.active = true;
            this.observed = target;
        }
        disconnect() {
            this.active = false;
        }
    }
    const counter = { raf: 0, writes: 0, cursor: 0 };
    const globals = {
        document: {
            fonts,
            createElement(tag: string) {
                assert.equal(tag, "canvas");
                const context: {
                    font: string;
                    letterSpacing?: string;
                    measureText: (text: string) => { width: number };
                } = {
                    font: "",
                    measureText(text) {
                        metrics.calls++;
                        const count = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)]
                            .length;
                        return {
                            width: count * 60 * metrics.factor + count * Number.parseFloat(context.letterSpacing || "0")
                        };
                    }
                };
                if (nativeTracking) context.letterSpacing = "0px";
                return { getContext: () => context };
            }
        },
        window: { getComputedStyle: () => ({ fontStyle: "normal", fontWeight: "700", fontFamily: "Test Display" }) },
        ResizeObserver: Observer,
        requestAnimationFrame(callback: FrameRequestCallback) {
            const id = ++counter.raf;
            raf.set(id, callback);
            return id;
        },
        cancelAnimationFrame(id: number) {
            raf.delete(id);
        }
    };
    const globalBefore = new Map<string, PropertyDescriptor | undefined>();
    for (const [key, value] of Object.entries(globals)) {
        globalBefore.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, { configurable: true, value });
    }
    const slots: Slot[] = [];
    const effects: Array<() => void> = [];
    const props = { name: "Stockholm", country: "Sweden" };
    const capture: { tree: ReactNode } = { tree: null };
    const original = { useState: React.useState, useRef: React.useRef, useLayoutEffect: React.useLayoutEffect };
    const slot = () => (slots[counter.cursor++] ??= {});
    function Probe() {
        React.useState = ((initial: unknown) => {
            const cell = slot();
            if (!("value" in cell)) cell.value = typeof initial === "function" ? initial() : initial;
            return [
                cell.value,
                (next: unknown) => {
                    const value = typeof next === "function" ? next(cell.value) : next;
                    if (!Object.is(value, cell.value)) counter.writes++;
                    cell.value = value;
                }
            ];
        }) as typeof React.useState;
        React.useRef = ((initial: unknown) => {
            const cell = slot();
            return (cell.value ??= { current: initial });
        }) as typeof React.useRef;
        React.useLayoutEffect = (effect, deps) => {
            const cell = slot();
            if (!cell.deps || !deps || deps.some((dep, index) => !Object.is(dep, cell.deps![index]))) {
                effects.push(() => {
                    cell.cleanup?.();
                    cell.cleanup = effect() || undefined;
                });
                cell.deps = deps;
            }
        };
        try {
            capture.tree = DestinationHeading(props);
        } finally {
            Object.assign(React, original);
        }
        return null;
    }
    function render(): Node {
        counter.cursor = 0;
        effects.length = 0;
        renderToStaticMarkup(createElement(Probe));
        for (const node of nodes(capture.tree)) {
            const ref = node.props.ref as { current: unknown } | undefined;
            if (ref) ref.current = node.type === "h1" ? title : node.type === "p" ? label : frame;
        }
        const writes = counter.writes;
        effects.forEach((effect) => effect());
        if (counter.writes !== writes) return render();
        const heading = nodes(capture.tree).find((node) => node.type === "h1");
        assert.ok(heading);
        return heading;
    }
    function flush() {
        const scheduled = [...raf.values()];
        raf.clear();
        scheduled.forEach((callback) => callback(0));
        return render();
    }
    function unmount() {
        slots.forEach((cell) => {
            cell.cleanup?.();
            cell.cleanup = undefined;
        });
    }
    t.after(() => {
        unmount();
        globalBefore.forEach((descriptor, key) => {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        });
    });
    const size = () => Number((render().props.style as { fontSize: number }).fontSize);
    render();
    return { props, frame, label, metrics, raf, observations, fonts, fontReady, counter, render, flush, size, unmount };
}

test("server-rendered destination heading is full real accessible text before browser measurements exist", () => {
    const html = renderToStaticMarkup(createElement(DestinationHeading, { name: "San Sebastián", country: "Spain" }));
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    assert.match(html, /<h1[^>]*aria-label="San Sebastián"[^>]*>San Sebastián<\/h1>/);
    assert.doesNotMatch(html, /<svg|<img|aria-hidden="true"/);
});

test("actual safe frame refits on width and height changes, including a sidebar-only resize", (t) => {
    const heading = harness(t);
    const initial = heading.size();
    const observer = heading.observations[0];
    assert.equal(observer.observed, heading.frame);
    heading.frame.clientWidth = 155;
    observer.callback();
    const narrow = Number((heading.flush().props.style as { fontSize: number }).fontSize);
    assert.ok(narrow < initial);
    heading.frame.clientHeight = 48;
    observer.callback();
    const short = Number((heading.flush().props.style as { fontSize: number }).fontSize);
    assert.ok(short < narrow);
    assert.equal(heading.render().props["aria-label"], "Stockholm");
});

test("a frame shorter than its country label keeps readable fallback text and recovers after resize", (t) => {
    const heading = harness(t);
    heading.frame.clientHeight = 15;
    heading.observations[0].callback();
    const fallback = heading.flush();
    assert.equal(fallback.props.style, undefined, "An unusable fit must not override CSS with a zero font size");
    assert.equal(text(fallback), "Stockholm");
    assert.equal(fallback.props["aria-label"], "Stockholm");
    heading.frame.clientHeight = 48;
    heading.observations[0].callback();
    const recovered = heading.flush();
    assert.ok(Number((recovered.props.style as { fontSize: number }).fontSize) > 0);
});

test("font readiness and later loading clear old metrics without churning identical fits", async (t) => {
    const heading = harness(t);
    const before = heading.size();
    heading.metrics.factor = 1.4;
    heading.fontReady.resolve();
    await Promise.resolve();
    heading.flush();
    assert.ok(heading.size() < before, "Final wider font must replace the fallback-font fit");
    const loaded = heading.size();
    heading.metrics.factor = 0.8;
    heading.fonts.dispatchEvent(new Event("loadingdone"));
    heading.flush();
    assert.ok(heading.size() > loaded, "Later font loads must also invalidate measured widths");
    const writes = heading.counter.writes;
    heading.observations[0].callback();
    heading.flush();
    assert.equal(heading.counter.writes, writes, "Identical dimensions and metrics retain the fit");
});

test("destination replacement disconnects old measurements and stale font callbacks cannot write after unmount", async (t) => {
    const heading = harness(t);
    const oldObserver = heading.observations[0];
    heading.props.name = "Buenos Aires";
    heading.props.country = "Argentina";
    assert.equal(heading.render().props["aria-label"], "Buenos Aires");
    assert.equal(text(heading.render()).replace(/\s+/gu, ""), "BUENOSAIRES", "The fitted title remains real text");
    assert.equal(oldObserver.active, false);
    assert.equal(heading.fonts.listeners.size, 1);
    const writes = heading.counter.writes;
    oldObserver.callback();
    assert.equal(heading.raf.size, 0, "Old observer must not schedule work for replaced destination");
    heading.observations.at(-1)!.callback();
    assert.equal(heading.raf.size, 1);
    heading.unmount();
    assert.equal(heading.raf.size, 0, "Unmount must cancel queued frame work");
    heading.fontReady.resolve();
    await Promise.resolve();
    heading.fonts.dispatchEvent(new Event("loadingdone"));
    heading.observations.at(-1)!.callback();
    assert.equal(heading.raf.size, 0);
    assert.equal(heading.counter.writes, writes);
    assert.equal(heading.fonts.listeners.size, 0);
    assert.ok(heading.observations.every((observer) => !observer.active));
});

test("canvas letterSpacing fallback produces the same measured-tracking fit", async (t) => {
    const result = { native: 0 };
    await t.test("native tracking", (child) => {
        result.native = harness(child).size();
    });
    await t.test("manual tracking", (child) => {
        assert.equal(harness(child, false).size(), result.native);
    });
});
