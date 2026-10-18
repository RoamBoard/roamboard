import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, { Children, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import BoardCard from "../src/components/features/boards/cards/BoardCard";
import { BoardCardPhoto } from "../src/components/features/boards/cards/BoardCardParts";
import { DestinationStories } from "../src/components/features/destinations/DestinationStories";
import type { DestinationBoardSummary } from "../src/lib/destination-guides";

type Props = ComponentProps<typeof DestinationStories>;
type Node = ReactElement<Record<string, unknown>>;

function summary(boardId: number): DestinationBoardSummary {
    return {
        boardId,
        username: `traveller_${boardId}`,
        title: `Journey ${boardId}`,
        description: null,
        durationDays: 2,
        tags: [],
        activityTitles: [],
        images: []
    };
}

// Run only the production component, retaining its hook state between calls. Children stay
// as elements so tests can invoke real gallery handlers without a DOM or a test renderer.
// This does not simulate browser event propagation, Motion's gesture detection or layout.
function galleryHarness(t: TestContext, changes: Partial<Props> = {}) {
    const slots: Array<{ value: unknown }> = [];
    const cursor = { value: 0 };
    t.mock.method(React, "useState", ((initial: unknown) => {
        const index = cursor.value++;
        slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
        return [
            slots[index].value,
            (next: unknown) => {
                slots[index].value = typeof next === "function" ? next(slots[index].value) : next;
            }
        ];
    }) as typeof React.useState);
    t.mock.method(React, "useRef", ((initial: unknown) => {
        const index = cursor.value++;
        slots[index] ??= { value: { current: initial } };
        return slots[index].value;
    }) as typeof React.useRef);
    t.mock.method(React, "useEffect", () => {});
    const props: Props = {
        name: "Kyoto",
        countryCode: "JPN",
        boards: [summary(101), summary(102), summary(103)],
        ...changes
    };
    return {
        props,
        render() {
            cursor.value = 0;
            return DestinationStories(props);
        }
    };
}

function nodes(root: ReactNode): Node[] {
    if (!isValidElement<Record<string, unknown>>(root)) return [];
    return [root, ...Children.toArray(root.props.children as ReactNode).flatMap(nodes)];
}

function find(root: ReactNode, predicate: (node: Node) => boolean): Node {
    const result = nodes(root).find(predicate);
    assert.ok(result, "The production gallery should expose this control");
    return result;
}

function invoke(node: Node, name: string, ...args: unknown[]) {
    const handler = node.props[name];
    assert.equal(typeof handler, "function");
    (handler as (...args: unknown[]) => void)(...args);
}

function selected(root: ReactNode): number {
    const card = find(
        root,
        (node) => node.type === BoardCard && Boolean((node.props.selection as { selected: boolean }).selected)
    );
    return Number((card.props.board as { id: string }).id);
}

function keyboard(root: ReactNode, key: string) {
    const region = find(root, (node) => node.props["aria-roledescription"] === "carousel");
    const calls = { focus: 0, prevented: 0, stopped: 0 };
    const target = { focus: () => calls.focus++ };
    invoke(region, "onKeyDown", {
        key,
        target,
        currentTarget: target,
        preventDefault: () => calls.prevented++,
        stopPropagation: () => calls.stopped++
    });
    return calls;
}

test("destination spatial gallery arrows, Home and End select real Boards without changing their navigation routes", (t) => {
    const gallery = galleryHarness(t);
    assert.equal(selected(gallery.render()), 101);
    assert.deepEqual(keyboard(gallery.render(), "ArrowRight"), { focus: 1, prevented: 1, stopped: 1 });
    assert.equal(selected(gallery.render()), 102);
    keyboard(gallery.render(), "End");
    assert.equal(selected(gallery.render()), 103);
    keyboard(gallery.render(), "ArrowRight");
    assert.equal(selected(gallery.render()), 101);
    keyboard(gallery.render(), "ArrowLeft");
    assert.equal(selected(gallery.render()), 103);
    keyboard(gallery.render(), "Home");
    assert.equal(selected(gallery.render()), 101);
    assert.deepEqual(keyboard(gallery.render(), "PageDown"), { focus: 0, prevented: 0, stopped: 0 });
    const link = find(gallery.render(), (node) => node.props.href === "/boards/101");
    assert.equal(link.props.onClick, undefined, "Open Board uses normal real navigation, separate from selection");
    invoke(
        find(gallery.render(), (node) => node.props["aria-label"] === "Next slide"),
        "onClick"
    );
    assert.equal(selected(gallery.render()), 102);
    invoke(
        find(gallery.render(), (node) => node.props["aria-label"] === "Previous slide"),
        "onClick"
    );
    assert.equal(selected(gallery.render()), 101);
});

test("selected public Board identity survives appended pages and reordered data, and removed Boards fall back safely", (t) => {
    const gallery = galleryHarness(t);
    keyboard(gallery.render(), "ArrowRight");
    gallery.props.boards = [...gallery.props.boards, summary(104)];
    assert.equal(selected(gallery.render()), 102);
    gallery.props.boards = [summary(104), summary(103), summary(102), summary(101)];
    assert.equal(selected(gallery.render()), 102);
    assert.ok(nodes(gallery.render()).some((node) => node.props.href === "/boards/102"));
    gallery.props.boards = [summary(104)];
    assert.equal(selected(gallery.render()), 104);
    gallery.props.boards = [];
    assert.equal(nodes(gallery.render()).filter((node) => node.type === BoardCard).length, 0);
});

test("gallery pans select at distance or velocity thresholds and suppress the resulting pointer click while preserving keyboard activation", (t) => {
    const gallery = galleryHarness(t);
    function pan(offset: number, velocity = 0) {
        const surface = find(gallery.render(), (node) => typeof node.props.onPanEnd === "function");
        invoke(surface, "onPointerDown");
        const info = { offset: { x: offset, y: 0 }, velocity: { x: velocity, y: 0 } };
        invoke(surface, "onPan", {}, info);
        invoke(surface, "onPanEnd", {}, info);
    }
    pan(-20);
    assert.equal(selected(gallery.render()), 101);
    pan(-50);
    assert.equal(selected(gallery.render()), 102);
    const card = find(
        gallery.render(),
        (node) => node.type === BoardCard && (node.props.board as { id: string }).id === "103"
    );
    const selection = card.props.selection as { onSelect: (event: unknown) => void };
    const click = { prevented: false };
    selection.onSelect({
        detail: 1,
        preventDefault: () => {
            click.prevented = true;
        }
    });
    assert.equal(click.prevented, true);
    assert.equal(selected(gallery.render()), 102);
    selection.onSelect({ detail: 0 });
    assert.equal(selected(gallery.render()), 103);
    pan(10, 400);
    assert.equal(selected(gallery.render()), 102);
    const surface = find(gallery.render(), (node) => typeof node.props.onPanEnd === "function");
    invoke(surface, "onPointerDown");
    const target = find(
        gallery.render(),
        (node) => node.type === BoardCard && (node.props.board as { id: string }).id === "101"
    );
    (target.props.selection as { onSelect: (event: unknown) => void }).onSelect({ detail: 1 });
    assert.equal(selected(gallery.render()), 101);
});

test("pagination and retry controls call the parent handlers while retaining loaded cards and disabling pending controls", (t) => {
    const calls = { load: 0, retry: 0 };
    const gallery = galleryHarness(t, { hasMore: true, onLoadMore: () => calls.load++, onRetry: () => calls.retry++ });
    const load = find(
        gallery.render(),
        (node) => node.type === "button" && node.props.onClick === gallery.props.onLoadMore
    );
    invoke(load, "onClick");
    assert.equal(calls.load, 1);
    gallery.props.loadingMore = true;
    assert.equal(
        find(gallery.render(), (node) => node.type === "button" && node.props.onClick === gallery.props.onLoadMore)
            .props.disabled,
        true
    );
    assert.equal(selected(gallery.render()), 101);
    gallery.props.error = "Next page unavailable";
    gallery.props.loadingMore = false;
    const retry = find(
        gallery.render(),
        (node) => node.type === "button" && node.props.onClick === gallery.props.onRetry
    );
    invoke(retry, "onClick");
    assert.equal(calls.retry, 1);
    assert.equal(selected(gallery.render()), 101);
    gallery.props.loadingMore = true;
    assert.equal(
        find(gallery.render(), (node) => node.type === "button" && node.props.onClick === gallery.props.onRetry).props
            .disabled,
        true
    );
});

test("direct public Board cover delivery preserves the image error callback and crop presentation", () => {
    const calls = { failures: 0 };
    const tree = BoardCardPhoto({
        image: {
            src: "http://localhost:3001/api/v1/images/44/content?variant=display&revision=7",
            alt: "Chosen cropped cover",
            unoptimized: true,
            crop: { width: 160, height: 140, left: -20, top: -10 },
            position: "60% 30%"
        },
        sizes: "420px",
        onError: () => calls.failures++
    });
    const image = find(tree, (node) => node.props.alt === "Chosen cropped cover");
    assert.equal(image.props.unoptimized, true);
    assert.equal(image.props.src, "http://localhost:3001/api/v1/images/44/content?variant=display&revision=7");
    assert.deepEqual(image.props.style, { objectPosition: "60% 30%" });
    assert.ok(
        nodes(tree).some(
            (node) =>
                JSON.stringify(node.props.style) ===
                JSON.stringify({ width: "160%", height: "140%", left: "-20%", top: "-10%" })
        )
    );
    invoke(image, "onError");
    assert.equal(calls.failures, 1, "Image failures must reach V4's existing failed-cover fallback");
});
