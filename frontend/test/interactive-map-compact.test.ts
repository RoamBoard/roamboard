import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, { type DependencyList } from "react";
import mapboxgl from "mapbox-gl";

import InteractiveMap, { type MapPoint } from "../src/components/features/providers/InteractiveMap";

const points: MapPoint[] = [
    { id: "morning", label: "Morning stop", latitude: 59.31, longitude: 18.02 },
    { id: "evening", label: "Evening stop", latitude: 59.35, longitude: 18.09 }
];

class Element {
    className = "";
    title = "";
    textContent = "";
    style: Record<string, string> = {};
    children: Element[] = [];
    constructor(
        public clientWidth = 0,
        public clientHeight = 0
    ) {}
    append(child: Element) {
        this.children.push(child);
    }
    setAttribute() {}
    addEventListener() {}
    querySelector(selector: string) {
        return this.children.find((child) => `.${child.className}` === selector) ?? null;
    }
    getBoundingClientRect() {
        return { width: this.clientWidth, height: this.clientHeight };
    }
}

type Fit = { bounds: number[][]; padding: number; maxZoom: number };
type Effect = { dependencies?: DependencyList; cleanup?: () => void };

function mountMap(
    context: TestContext,
    width: number,
    height: number,
    options: { points?: MapPoint[]; selectedPointId?: string; selectedZoom?: number } = {}
) {
    const container = new Element(width, height);
    const fits: Fit[] = [];
    const cameraMoves: Array<{ center: [number, number]; zoom: number }> = [];
    const events = new Map<string, Array<() => void>>();
    const timers = new Map<number, () => void>();
    const mapInstances: FakeMap[] = [];
    const source = { setData() {} };
    const sourceBounds: Array<[number, number]> = [];
    class FakeMap {
        scrollZoom = { disable() {} };
        constructor() {
            mapInstances.push(this);
        }
        addControl() {
            return this;
        }
        addSource() {
            return this;
        }
        addLayer() {
            return this;
        }
        getSource() {
            return source;
        }
        getContainer() {
            return container;
        }
        resize() {
            return this;
        }
        remove() {}
        easeTo(move: { center: [number, number]; zoom: number }) {
            cameraMoves.push(move);
            return this;
        }
        on(event: string, callback: () => void) {
            events.set(event, [...(events.get(event) ?? []), callback]);
            return this;
        }
        fitBounds(bounds: mapboxgl.LngLatBounds, options: { padding: number; maxZoom: number }) {
            const coordinates = bounds.toArray();
            assert.ok(
                coordinates.flat().every(Number.isFinite),
                "The real fit must receive finite geographical bounds"
            );
            assert.ok(options.padding >= 0 && Number.isFinite(options.padding));
            assert.ok(
                width - 2 * options.padding > 0 && height - 2 * options.padding > 0,
                "Padding must leave a positive camera viewport instead of producing invalid LngLat values"
            );
            fits.push({ bounds: coordinates, padding: options.padding, maxZoom: options.maxZoom });
            return this;
        }
    }
    class FakeMarker {
        constructor(private options: { element: Element }) {}
        setLngLat(coordinates: [number, number]) {
            sourceBounds.push(coordinates);
            return this;
        }
        addTo() {
            return this;
        }
        remove() {}
        getElement() {
            return this.options.element;
        }
    }
    const originalMapbox = {
        Map: mapboxgl.Map,
        Marker: mapboxgl.Marker,
        NavigationControl: mapboxgl.NavigationControl,
        accessToken: mapboxgl.accessToken
    };
    mapboxgl.Map = FakeMap as unknown as typeof mapboxgl.Map;
    mapboxgl.Marker = FakeMarker as unknown as typeof mapboxgl.Marker;
    mapboxgl.NavigationControl = class {} as unknown as typeof mapboxgl.NavigationControl;
    const previousGlobals = ["window", "document", "ResizeObserver"].map((key) => ({
        key,
        descriptor: Object.getOwnPropertyDescriptor(globalThis, key)
    }));
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
            setTimeout(callback: () => void) {
                const id = timers.size + 1;
                timers.set(id, callback);
                return id;
            },
            clearTimeout(id: number) {
                timers.delete(id);
            }
        }
    });
    Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: { createElement: () => new Element() }
    });
    Object.defineProperty(globalThis, "ResizeObserver", {
        configurable: true,
        value: class {
            observe() {}
            disconnect() {}
        }
    });
    const states: unknown[] = [];
    const refs: Array<{ current: unknown }> = [];
    const effects: Effect[] = [];
    context.after(() => {
        effects.forEach((effect) => effect.cleanup?.());
        Object.assign(mapboxgl, originalMapbox);
        previousGlobals.forEach(({ key, descriptor }) => {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        });
    });
    function render() {
        const cursor = { state: 0, ref: 0, effect: 0 };
        const pending: Array<() => void> = [];
        const hooks = { useState: React.useState, useRef: React.useRef, useEffect: React.useEffect };
        React.useState = ((initial: unknown) => {
            const index = cursor.state++;
            if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
            return [
                states[index],
                (next: unknown) => {
                    states[index] = typeof next === "function" ? next(states[index]) : next;
                }
            ];
        }) as typeof React.useState;
        React.useRef = ((initial: unknown) => (refs[cursor.ref++] ??= { current: initial })) as typeof React.useRef;
        React.useEffect = (effect, dependencies) => {
            const index = cursor.effect++;
            const previous = effects[index];
            const changed =
                !previous ||
                !dependencies ||
                !previous.dependencies ||
                dependencies.length !== previous.dependencies.length ||
                dependencies.some((value, offset) => !Object.is(value, previous.dependencies![offset]));
            if (changed)
                pending.push(() => {
                    previous?.cleanup?.();
                    effects[index] = { dependencies, cleanup: effect() || undefined };
                });
        };
        try {
            InteractiveMap({
                token: "pk.test-token",
                points,
                routeGeometry: [],
                cooperativeGestures: true,
                ...options
            });
            refs[0].current = container;
        } finally {
            Object.assign(React, hooks);
        }
        pending.forEach((effect) => effect());
    }
    render();
    for (const [id, callback] of timers) {
        timers.delete(id);
        callback();
    }
    assert.equal(mapInstances.length, 1, "The production initialization effect must create the map");
    assert.equal(fits.length, 0, "Camera fitting must wait for the map's load event");
    events.get("load")?.forEach((callback) => callback());
    render();
    return { fits, sourceBounds, cameraMoves };
}

for (const [width, height] of [
    [240, 112],
    [240, 128],
    [96, 240]
]) {
    test(`multi-point ${width} by ${height} maps fit their real camera with room remaining inside every inset`, (context) => {
        const result = mountMap(context, width, height);
        assert.equal(result.fits.length, 1);
        assert.equal(result.fits[0].padding, Math.min(64, width / 4, height / 4));
        assert.equal(result.fits[0].maxZoom, 14);
        assert.deepEqual(result.fits[0].bounds, [
            [18.02, 59.31],
            [18.09, 59.35]
        ]);
        assert.deepEqual(result.sourceBounds, [
            [18.02, 59.31],
            [18.09, 59.35]
        ]);
    });
}

test("ordinary large maps keep the existing 64-pixel camera padding", (context) => {
    const result = mountMap(context, 960, 640);
    assert.equal(result.fits.length, 1);
    assert.equal(result.fits[0].padding, 64);
});

test("a shared single-point map focuses the saved location at zoom 15 without fitting multiple-point bounds", (context) => {
    const result = mountMap(context, 480, 320, { points: [points[0]] });
    assert.deepEqual(result.fits, []);
    assert.ok(result.cameraMoves.length > 0, "The real camera effect must focus the saved point");
    assert.deepEqual(result.cameraMoves.at(-1), { center: [18.02, 59.31], zoom: 15 });
});

test("selecting a saved pin uses the shared close focus while preserving the initial multi-pin fit", (context) => {
    const result = mountMap(context, 960, 640, { selectedPointId: "evening" });
    assert.equal(result.fits.length, 1);
    assert.equal(result.fits[0].padding, 64);
    assert.equal(result.fits[0].maxZoom, 14);
    assert.deepEqual(result.cameraMoves.at(-1), { center: [18.09, 59.35], zoom: 15 });
});

for (const [width, height] of [
    [0, 128],
    [240, 0],
    [0, 0]
]) {
    test(`a ${width} by ${height} map does not fit bounds into a zero-sized camera viewport`, (context) => {
        const result = mountMap(context, width, height);
        assert.deepEqual(result.fits, []);
    });
}
