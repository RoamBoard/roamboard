import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ImageZoomDialog from "../src/components/ui/ImageZoomDialog";
import BoardPhoto, { creditLink } from "../src/components/features/boards/BoardPhoto";
import ActivityDetailsDialog from "../src/components/features/boards/ActivityDetailsDialog";
import StoryPhoto from "../src/components/features/boards/StoryPhoto";
import StoryGallery from "../src/components/features/boards/StoryGallery";
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
    props: { images: BoardImage[]; initialIndex?: number; onClose: () => void },
    options: { prefersReducedMotion?: boolean } = {}
) {
    const winListeners = new Map<string, Set<(e: unknown) => void>>();
    const preloadRequests: string[] = [];
    const winState = {
        Image: class {
            set src(value: string) {
                if (value) preloadRequests.push(value);
            }
        },
        addEventListener: (type: string, listener: (e: unknown) => void) => {
            if (!winListeners.has(type)) winListeners.set(type, new Set());
            winListeners.get(type)!.add(listener);
        },
        removeEventListener: (type: string, listener: (e: unknown) => void) => {
            winListeners.get(type)?.delete(listener);
        },
        matchMedia: () => ({
            matches: options.prefersReducedMotion ?? false,
            addEventListener: noop,
            removeEventListener: noop
        })
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
        preloadRequests,
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

test("activity detail photos open their placement in the shared Board gallery and locations focus the map", () => {
    const photoRequests: Array<{ activity: BoardActivity; index: number }> = [];
    const locationRequests: BoardActivity[] = [];
    const { markup, nodes } = capture(() =>
        ActivityDetailsDialog({
            activity: testActivity,
            days: [{ number: 1, title: "Day 1", items: [testActivity] }],
            onClose: noop,
            onOpenPhoto: (activity, index) => photoRequests.push({ activity, index }),
            onFocusLocation: (activity) => locationRequests.push(activity)
        })
    );
    assert.match(markup, /aria-label="Enlarge (?:photo: )?Mountain sunrise"/);
    assert.match(markup, /aria-label="Enlarge (?:photo: )?Alpine lake"/);
    assert.ok(markup.includes("Photo by"));
    assert.ok(markup.includes("Jane Doe"));
    assert.ok(markup.includes("Alpine lake"));
    assert.ok(markup.includes(testActivity.description));
    assert.doesNotMatch(markup, /Save activity preview|Copy activity preview/);
    const photos = nodes.filter((node) => node.type === StoryPhoto);
    assert.equal(photos.length, 2);
    (photos[1].props.onOpen as () => void)();
    assert.deepEqual(photoRequests, [{ activity: testActivity, index: 1 }]);
    const location = nodes.find((node) => node.type === "button" && node.props.children === "Mount Rainier");
    assert.ok(location);
    (location.props.onClick as () => void)();
    assert.deepEqual(locationRequests, [testActivity]);
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

test("empty image-stage space closes the gallery while clicking the photo zooms it", (context) => {
    const closed: boolean[] = [];
    const harness = mountZoomDialog(context, { images: testImages, onClose: () => closed.push(true) });
    const stage = harness.nodes.find((node) => node.type === "main");
    assert.ok(stage);
    const click = stage.props.onClick as (event: { target: object; currentTarget: object }) => void;
    const background = {};
    click({ target: background, currentTarget: background });
    assert.equal(closed.length, 1);
    click({ target: {}, currentTarget: background });
    harness.render();
    assert.equal(closed.length, 1);
    assert.ok(harness.nodes.some((node) => node.props.children === "200%"));
});

test("gallery arrows follow the actual loaded photo width and zoom, using shared controls", (context) => {
    const harness = mountZoomDialog(context, { images: testImages, onClose: noop });
    const photo = harness.nodes.find((node) => node.props.src === testImages[0].url);
    assert.ok(photo);
    (photo.props.onLoad as (event: unknown) => void)({ currentTarget: { naturalWidth: 600, naturalHeight: 900 } });
    harness.render();
    const stage = harness.nodes.find((node) => node.type === "main");
    assert.match(String((stage?.props.style as Record<string, string>)["--photo-width"]), /0\.666/);
    const previous = harness.nodes.find((node) => node.props["aria-label"] === "Previous photo");
    assert.ok(previous);
    assert.match(String((previous.props.style as { left: string }).left), /var\(--photo-width\) \* 0\.5/);
    harness.emitKeyDown("+");
    harness.render();
    const zoomed = harness.nodes.find((node) => node.props["aria-label"] === "Previous photo");
    assert.match(String((zoomed?.props.style as { left: string }).left), /var\(--photo-width\) \* 0\.75/);
    const dialog = harness.nodes.find((node) => node.props.role === "dialog");
    assert.match(String(dialog?.props.className), /bg-black\/75/);
});

test("BoardPhoto disables hover scale when motion reduction is preferred", () => {
    const { nodes } = capture(() => BoardPhoto({ image: testImages[0], zoomable: true }));
    const img = nodes.find(
        (n) =>
            typeof n.props.className === "string" &&
            n.props.className.includes("motion-safe:group-hover/photo:scale-103") &&
            n.props.className.includes("motion-reduce:transform-none")
    );
    assert.ok(img, "Zoomable photo must disable hover scale for reduced motion");
});

test("ImageZoomDialog disables zoom transition when reduced motion is preferred", (context) => {
    const harness = mountZoomDialog(
        context,
        {
            images: testImages,
            initialIndex: 0,
            onClose: noop
        },
        { prefersReducedMotion: true }
    );

    const animatedBox = harness.nodes.find(
        (n) => typeof n.props.className === "string" && n.props.className.includes("motion-reduce:transition-none")
    );
    assert.ok(animatedBox, "Image container must have motion-reduce:transition-none");
    assert.ok(
        typeof animatedBox.props.className === "string" &&
            animatedBox.props.className.includes("motion-safe:transition-transform"),
        "Transform animation must only apply when motion is safe; the browser handles preference changes"
    );
});

test("the story gallery forwards every ordered placement and the clicked index into the shared zoom dialog", () => {
    const placements = [
        { id: "cover", image: testImages[0] },
        { id: "activity-cover-reuse", image: testImages[0] },
        { id: "activity-second-photo", image: testImages[1] }
    ];
    const closed: boolean[] = [];
    const { nodes } = capture(() => StoryGallery({ placements, initialIndex: 1, onClose: () => closed.push(true) }));
    const zoom = nodes.find((node) => node.type === ImageZoomDialog);
    assert.ok(zoom);
    assert.deepEqual(zoom.props.images, [testImages[0], testImages[0], testImages[1]]);
    assert.equal(zoom.props.initialIndex, 1);
    (zoom.props.onClose as () => void)();
    assert.deepEqual(closed, [true]);
});

const largeImages: BoardImage[] = [0, 1, 2, 3].map((index) => ({
    ...testImages[index % 2],
    id: `large-photo-${index}`,
    url: `https://images.unsplash.com/gallery-${index}?w=1600`,
    largeUrl: `https://images.unsplash.com/gallery-${index}?w=4096`
}));

test("large-image failure preserves the working display image, gallery position and attribution", (context) => {
    const harness = mountZoomDialog(context, { images: largeImages, initialIndex: 1, onClose: noop });
    const display = harness.nodes.find((node) => node.props.src === largeImages[1].url);
    const large = harness.nodes.find((node) => node.props.src === largeImages[1].largeUrl);
    assert.ok(display);
    assert.ok(large);
    assert.equal((display.props.style as { opacity: number }).opacity, 1);
    assert.equal((large.props.style as { opacity: number }).opacity, 0);
    assert.deepEqual(harness.preloadRequests, [], "Do not warm unrelated photos before the selected large photo loads");
    (large.props.onError as () => void)();
    harness.render();
    const fallback = harness.nodes.find((node) => node.props.src === largeImages[1].url);
    assert.equal((fallback?.props.style as { opacity: number }).opacity, 1);
    assert.ok(harness.nodes.some((node) => node.props.children === "2 / 4"));
    assert.ok(harness.nodes.some((node) => node.props.children === "John Smith"));
    assert.deepEqual(harness.preloadRequests, []);
});

test("large photos load on demand and warm only their two immediate neighbours after loading", (context) => {
    const harness = mountZoomDialog(context, { images: largeImages, initialIndex: 0, onClose: noop });
    const sources = () =>
        harness.nodes.filter((node) => typeof node.props.src === "string").map((node) => node.props.src);
    assert.deepEqual(sources(), [largeImages[0].url, largeImages[0].largeUrl]);
    assert.deepEqual(harness.preloadRequests, []);
    const selected = harness.nodes.find((node) => node.props.src === largeImages[0].largeUrl);
    assert.ok(selected);
    (selected.props.onLoad as () => void)();
    harness.render();
    assert.deepEqual(harness.preloadRequests, [largeImages[3].largeUrl, largeImages[1].largeUrl]);
    const upgraded = harness.nodes.find((node) => node.props.src === largeImages[0].largeUrl);
    assert.equal((upgraded?.props.style as { opacity: number }).opacity, 1);
    harness.emitKeyDown("ArrowRight");
    harness.render();
    assert.deepEqual(sources(), [largeImages[1].url, largeImages[1].largeUrl]);
    assert.equal(harness.preloadRequests.length, 2, "The next photo must load before another neighbour pair is warmed");
    const fallback = harness.nodes.find((node) => node.props.src === largeImages[1].url);
    assert.equal((fallback?.props.style as { opacity: number }).opacity, 1);
});

test("touch swipes navigate photos while vertical gestures, small motions and zoomed panning preserve the photo", (context) => {
    const harness = mountZoomDialog(context, { images: testImages, initialIndex: 0, onClose: noop });
    const target = { setPointerCapture: noop, releasePointerCapture: noop };
    const pointer = (x: number, y: number) => ({
        pointerType: "touch",
        pointerId: 1,
        clientX: x,
        clientY: y,
        preventDefault: noop,
        currentTarget: target
    });
    const stage = () => {
        const found = harness.nodes.find((node) => node.type === "main");
        assert.ok(found);
        return found;
    };
    const swipe = (from: [number, number], to: [number, number]) => {
        const current = stage();
        (current.props.onPointerDown as (event: ReturnType<typeof pointer>) => void)(pointer(...from));
        (current.props.onPointerMove as (event: ReturnType<typeof pointer>) => void)(pointer(...to));
        (current.props.onPointerUp as (event: ReturnType<typeof pointer>) => void)(pointer(...to));
        (current.props.onClick as () => void)();
        harness.render();
    };
    swipe([150, 100], [60, 105]);
    assert.ok(harness.nodes.some((node) => node.props.children === "2 / 2"));
    assert.ok(
        harness.nodes.some((node) => node.props.children === "100%"),
        "A swipe must not also zoom the photo"
    );
    swipe([60, 100], [150, 105]);
    assert.ok(harness.nodes.some((node) => node.props.children === "1 / 2"));
    const vertical = stage();
    (vertical.props.onPointerDown as (event: ReturnType<typeof pointer>) => void)(pointer(60, 100));
    (vertical.props.onPointerUp as (event: ReturnType<typeof pointer>) => void)(pointer(65, 200));
    harness.render();
    assert.ok(harness.nodes.some((node) => node.props.children === "1 / 2"));
    const small = stage();
    (small.props.onPointerDown as (event: ReturnType<typeof pointer>) => void)(pointer(60, 100));
    (small.props.onPointerUp as (event: ReturnType<typeof pointer>) => void)(pointer(80, 105));
    harness.render();
    assert.ok(harness.nodes.some((node) => node.props.children === "1 / 2"));
    harness.emitKeyDown("+");
    harness.render();
    const down = stage();
    (down.props.onPointerDown as (event: ReturnType<typeof pointer>) => void)(pointer(150, 100));
    harness.render();
    const dragging = stage();
    (dragging.props.onPointerMove as (event: ReturnType<typeof pointer>) => void)(pointer(60, 105));
    (dragging.props.onPointerUp as (event: ReturnType<typeof pointer>) => void)(pointer(60, 105));
    harness.render();
    assert.ok(harness.nodes.some((node) => node.props.children === "1 / 2"));
    assert.ok(harness.nodes.some((node) => node.props.children === "150%"));
    assert.ok(
        harness.nodes.some((node) =>
            String((node.props.style as { transform?: string })?.transform).includes("translate(-90px, 5px)")
        )
    );
});
