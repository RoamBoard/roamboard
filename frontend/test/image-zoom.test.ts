import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ImageZoomDialog from "../src/components/ui/ImageZoomDialog";
import BoardPhoto, { creditLink } from "../src/components/features/boards/BoardPhoto";
import ActivityDetailsDialog from "../src/components/features/boards/ActivityDetailsDialog";
import type { BoardActivity, BoardImage } from "../src/types/board";

type Props = { children?: ReactNode; [name: string]: unknown };

function elements(node: ReactNode): Array<{ type: unknown; props: Props }> {
    if (!isValidElement<Props>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(elements)];
}

function capture(render: () => ReactNode) {
    const holder: { tree: ReactNode } = { tree: null };
    function Probe() {
        holder.tree = render();
        return holder.tree;
    }
    const markup = renderToStaticMarkup(createElement(Probe));
    return { markup, nodes: elements(holder.tree) };
}

const noop = () => {};

const testImages: BoardImage[] = [
    {
        id: "img-1",
        url: "https://images.unsplash.com/photo-1?w=1200",
        alt: "Mountain sunrise",
        source: "application",
        photographer: "Jane Doe",
        photographerUrl: "https://unsplash.com/@janedoe",
        sourceUrl: "https://unsplash.com/photos/abc"
    },
    {
        id: "img-2",
        url: "https://images.unsplash.com/photo-2?w=1200",
        alt: "Alpine lake",
        source: "application",
        photographer: "John Smith",
        photographerUrl: "https://unsplash.com/@johnsmith",
        sourceUrl: "https://unsplash.com/photos/def"
    }
];

const testActivity: BoardActivity = {
    id: "act-1",
    type: "activity",
    title: "Sunrise Hike",
    description: "Hike up to the summit for sunrise.",
    time: "06:00",
    images: testImages,
    location: {
        id: "loc-1",
        source: "manual",
        name: "Mount Rainier",
        address: "Washington, USA",
        latitude: 46.8523,
        longitude: -121.7603
    }
};

function mountZoomDialog(
    context: TestContext,
    props: { images: BoardImage[]; initialIndex?: number; onClose: () => void }
) {
    const winListeners = new Map<string, Set<(e: unknown) => void>>();
    const winState = {
        addEventListener: (type: string, listener: (e: unknown) => void) => {
            if (!winListeners.has(type)) winListeners.set(type, new Set());
            winListeners.get(type)!.add(listener);
        },
        removeEventListener: (type: string, listener: (e: unknown) => void) => {
            winListeners.get(type)?.delete(listener);
        }
    };

    const docState = {
        body: { style: { overflow: "" } },
        addEventListener: noop,
        removeEventListener: noop,
        activeElement: null
    };

    const originalDoc = Object.getOwnPropertyDescriptor(globalThis, "document");
    const originalWin = Object.getOwnPropertyDescriptor(globalThis, "window");

    Object.defineProperty(globalThis, "document", { configurable: true, value: docState });
    Object.defineProperty(globalThis, "window", { configurable: true, value: winState });

    const states: unknown[] = [];
    const refs: Array<{ current: unknown }> = [];
    const effects: Array<{ index: number; effect: () => void | (() => void) }> = [];
    const effectCleanups: Record<number, () => void> = {};

    const holder: { tree: ReactNode } = { tree: null };

    const unmount = () => {
        Object.values(effectCleanups).forEach((cleanup) => cleanup());
        if (originalDoc) Object.defineProperty(globalThis, "document", originalDoc);
        else Reflect.deleteProperty(globalThis, "document");
        if (originalWin) Object.defineProperty(globalThis, "window", originalWin);
        else Reflect.deleteProperty(globalThis, "window");
    };
    context.after(unmount);

    function runRender() {
        const cursor = { state: 0, ref: 0, effect: 0 };
        const original = {
            useState: React.useState,
            useRef: React.useRef,
            useCallback: React.useCallback,
            useEffect: React.useEffect
        };

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

        React.useRef = ((initial: unknown) => {
            const index = cursor.ref++;
            return (refs[index] ??= { current: initial });
        }) as typeof React.useRef;

        React.useCallback = ((fn: (...args: unknown[]) => unknown) => {
            return fn;
        }) as typeof React.useCallback;

        React.useEffect = (effect) => {
            const index = cursor.effect++;
            effects.push({ index, effect });
        };

        try {
            holder.tree = ImageZoomDialog(props);
        } finally {
            Object.assign(React, original);
        }

        for (const item of effects.splice(0)) {
            if (effectCleanups[item.index]) {
                effectCleanups[item.index]();
                delete effectCleanups[item.index];
            }
            const cleanup = item.effect();
            if (cleanup) effectCleanups[item.index] = cleanup;
        }

        return { nodes: elements(holder.tree) };
    }

    runRender();

    return {
        get nodes() {
            return elements(holder.tree);
        },
        render: runRender,
        unmount,
        emitKeyDown: (keyOrEvent: string | { key: string; shiftKey?: boolean }) => {
            const ev =
                typeof keyOrEvent === "string"
                    ? { key: keyOrEvent, shiftKey: false, preventDefault: noop }
                    : { shiftKey: false, preventDefault: noop, ...keyOrEvent };
            winListeners.get("keydown")?.forEach((cb) => cb(ev));
        }
    };
}

test("creditLink adds roamboard referral parameters to unsplash links", () => {
    const link = creditLink("https://unsplash.com/@photographer");
    assert.ok(link);
    const parsed = new URL(link);
    assert.equal(parsed.searchParams.get("utm_source"), "roamboard");
    assert.equal(parsed.searchParams.get("utm_medium"), "referral");

    assert.equal(creditLink("https://example.com/not-unsplash"), undefined);
    assert.equal(creditLink("invalid-url"), undefined);
});

test("BoardPhoto without zoomable renders normal container without zoom button", () => {
    const { nodes } = capture(() => BoardPhoto({ image: testImages[0] }));
    const zoomButton = nodes.find((n) => n.props["aria-label"]?.toString().includes("Enlarge photo"));
    assert.equal(zoomButton, undefined);
});

test("BoardPhoto with zoomable renders zoomable trigger with accessible label", () => {
    const { nodes } = capture(() => BoardPhoto({ image: testImages[0], zoomable: true }));
    const zoomTrigger = nodes.find((n) => n.props["aria-label"] === "Enlarge photo: Mountain sunrise");
    assert.ok(zoomTrigger, "Zoomable BoardPhoto must render an accessible trigger");
    assert.equal(zoomTrigger.props.role, "button");
    assert.equal(zoomTrigger.props.tabIndex, 0);
});

test("BoardPhoto with zoomable and onZoom invokes callback when clicked", () => {
    const events: string[] = [];
    const { nodes } = capture(() =>
        BoardPhoto({
            image: testImages[0],
            zoomable: true,
            onZoom: () => events.push("zoomed")
        })
    );
    const trigger = nodes.find((n) => n.props["aria-label"] === "Enlarge photo: Mountain sunrise");
    assert.ok(trigger);

    (trigger.props.onClick as (e: { stopPropagation: () => void }) => void)({ stopPropagation: noop });
    assert.deepEqual(events, ["zoomed"]);

    (trigger.props.onKeyDown as (e: { key: string; preventDefault: () => void }) => void)({
        key: "Enter",
        preventDefault: noop
    });
    assert.deepEqual(events, ["zoomed", "zoomed"]);

    (trigger.props.onKeyDown as (e: { key: string; preventDefault: () => void }) => void)({
        key: " ",
        preventDefault: noop
    });
    assert.deepEqual(events, ["zoomed", "zoomed", "zoomed"]);
});

test("ActivityDetailsDialog renders zoomable activity photos", () => {
    const { markup } = capture(() =>
        ActivityDetailsDialog({
            activity: testActivity,
            days: [{ number: 1, title: "Day 1", items: [testActivity] }],
            saved: false,
            onClose: noop,
            onSave: noop,
            onCopy: noop,
            children: null
        })
    );
    assert.ok(markup.includes("Enlarge photo: Mountain sunrise"));
    assert.ok(markup.includes("Enlarge photo: Alpine lake"));
    assert.ok(markup.includes("Photo by"));
    assert.ok(markup.includes("Jane Doe"));
    assert.ok(markup.includes("Alpine lake"));
});

test("ImageZoomDialog displays enlarged photo with controls, counter, and attribution", (context) => {
    const closed: boolean[] = [];
    const harness = mountZoomDialog(context, {
        images: testImages,
        initialIndex: 0,
        onClose: () => closed.push(true)
    });

    const dialog = harness.nodes.find((n) => n.props.role === "dialog");
    assert.ok(dialog, "Dialog container must be present");
    assert.equal(dialog.props["aria-modal"], "true");
    assert.equal(dialog.props["aria-label"], "Enlarged photo view");

    // Counter
    const counter = harness.nodes.find((n) => n.props.children && n.props.children.toString().includes("1 / 2"));
    assert.ok(counter, "Counter must show 1 / 2");

    // Controls
    const zoomInBtn = harness.nodes.find((n) => n.props["aria-label"] === "Zoom in");
    const zoomOutBtn = harness.nodes.find((n) => n.props["aria-label"] === "Zoom out");
    const closeBtn = harness.nodes.find((n) => n.props["aria-label"] === "Close enlarged view");
    const prevBtn = harness.nodes.find((n) => n.props["aria-label"] === "Previous photo");
    const nextBtn = harness.nodes.find((n) => n.props["aria-label"] === "Next photo");

    assert.ok(zoomInBtn);
    assert.ok(zoomOutBtn);
    assert.ok(closeBtn);
    assert.ok(prevBtn);
    assert.ok(nextBtn);

    // Attribution
    const attribution = harness.nodes.find((n) => n.props.children === "Jane Doe");
    assert.ok(attribution, "Photographer Jane Doe must be credited");

    // Stage accessibility, touch-action, and reduced motion
    const stage = harness.nodes.find(
        (n) => typeof n.props.className === "string" && n.props.className.includes("touch-none")
    );
    assert.ok(stage, "Main stage must set touch-action none via touch-none");
    assert.equal(typeof stage.props.onPointerCancel, "function", "Stage must handle onPointerCancel");

    const animatedBox = harness.nodes.find(
        (n) => typeof n.props.className === "string" && n.props.className.includes("motion-reduce:transition-none")
    );
    assert.ok(animatedBox, "Image container must support reduced motion");

    // Clicking close calls onClose
    (closeBtn.props.onClick as () => void)();
    assert.equal(closed.length, 1);
});

test("ImageZoomDialog keyboard navigation, panning, and zoom shortcuts", (context) => {
    const harness = mountZoomDialog(context, {
        images: testImages,
        initialIndex: 0,
        onClose: noop
    });

    // Press right arrow to navigate to second image
    harness.emitKeyDown("ArrowRight");
    harness.render();

    const counter = harness.nodes.find((n) => n.props.children && n.props.children.toString().includes("2 / 2"));
    assert.ok(counter, "After pressing right arrow, counter must show 2 / 2");

    const secondAttribution = harness.nodes.find((n) => n.props.children === "John Smith");
    assert.ok(secondAttribution, "Photographer John Smith must be credited for second image");

    // Press left arrow to return to first image
    harness.emitKeyDown("ArrowLeft");
    harness.render();

    const firstCounter = harness.nodes.find((n) => n.props.children && n.props.children.toString().includes("1 / 2"));
    assert.ok(firstCounter, "After pressing left arrow, counter must show 1 / 2");

    // Zoom shortcuts
    harness.emitKeyDown("+");
    harness.render();
    const scaleBadge = harness.nodes.find((n) => n.props.children && n.props.children.toString().includes("150%"));
    assert.ok(scaleBadge, "Scale must increase to 150% after pressing +");

    // Keyboard panning when zoomed in
    harness.emitKeyDown("ArrowUp");
    harness.render();
    const pannedUpStage = harness.nodes.find((n) =>
        String((n.props.style as { transform?: string })?.transform).includes("translate(0px, 50px)")
    );
    assert.ok(pannedUpStage, "ArrowUp must pan up 50px when zoomed in");

    harness.emitKeyDown({ key: "ArrowLeft", shiftKey: true });
    harness.render();
    const pannedLeftStage = harness.nodes.find((n) =>
        String((n.props.style as { transform?: string })?.transform).includes("translate(50px, 50px)")
    );
    assert.ok(pannedLeftStage, "Shift+ArrowLeft must pan left 50px when zoomed in");

    // Reset zoom with 0
    harness.emitKeyDown("0");
    harness.render();
    const resetBadge = harness.nodes.find((n) => n.props.children && n.props.children.toString().includes("100%"));
    assert.ok(resetBadge, "Scale must reset to 100% after pressing 0");
});

test("BoardPhoto disables hover scale when motion reduction is preferred", () => {
    const { nodes } = capture(() => BoardPhoto({ image: testImages[0], zoomable: true }));
    const img = nodes.find(
        (n) =>
            typeof n.props.className === "string" &&
            n.props.className.includes("motion-reduce:group-hover/photo:transform-none")
    );
    assert.ok(img, "Zoomable photo must disable hover scale for reduced motion");
});
