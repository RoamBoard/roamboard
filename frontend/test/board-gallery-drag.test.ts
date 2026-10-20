import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, { Children, isValidElement, type ReactNode, type ReactElement } from "react";
import SpatialGallery from "../src/components/features/boards/SpatialGallery";
import { BoardSelectionGallery } from "../src/components/features/boards/BoardSelectionGallery";
import { mockBoardCollections } from "../src/data/my-board-collections";
import { toSelectionBoard } from "../src/lib/board-selection";

type Node = ReactElement<Record<string, unknown>>;
function nodes(tree: ReactNode): Node[] {
    if (!isValidElement<Record<string, unknown>>(tree)) return [];
    return [tree, ...Children.toArray(tree.props.children as ReactNode).flatMap(nodes)];
}
function find(tree: ReactNode, predicate: (node: Node) => boolean) {
    const found = nodes(tree).find(predicate);
    assert.ok(found);
    return found;
}
function hooks(t: TestContext) {
    const slots: unknown[] = [];
    const cursor = { value: 0 };
    t.mock.method(React, "useState", ((initial: unknown) => {
        const index = cursor.value++;
        if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
        return [
            slots[index],
            (next: unknown) => {
                slots[index] = typeof next === "function" ? next(slots[index]) : next;
            }
        ];
    }) as typeof React.useState);
    t.mock.method(React, "useRef", ((initial: unknown) => {
        const index = cursor.value++;
        slots[index] ??= { current: initial };
        return slots[index];
    }) as typeof React.useRef);
    t.mock.method(React, "useEffect", () => {});
    return () => {
        cursor.value = 0;
    };
}
function invoke(node: Node, name: string, ...args: unknown[]) {
    (node.props[name] as (...args: unknown[]) => void)(...args);
}

test("featured cards follow a drag continuously, suppress overlays/navigation, and settle onto the next Board", (t) => {
    const reset = hooks(t);
    const boards = mockBoardCollections.created.slice(0, 3);
    const render = () => {
        reset();
        return SpatialGallery({ boards });
    };
    const stage = find(render(), (node) => typeof node.props.onPan === "function");
    invoke(stage, "onPointerDown");
    const info = { offset: { x: -156, y: 0 }, velocity: { x: -400, y: 0 } };
    invoke(stage, "onPan", {}, info);
    const dragging = render();
    const moving = find(dragging, (node) => node.props["data-spatial-card"] === "active");
    assert.notEqual((moving.props.animate as { x: string }).x, "0%");
    const card = find(dragging, (node) => node.props.suppressHover === true && Boolean(node.props.selection));
    const selection = card.props.selection as { onNavigate: (event: unknown) => void };
    const blocked = { value: false };
    selection.onNavigate({
        detail: 1,
        preventDefault: () => {
            blocked.value = true;
        }
    });
    assert.equal(blocked.value, true);
    invoke(
        find(dragging, (node) => typeof node.props.onPanEnd === "function"),
        "onPanEnd",
        {},
        info
    );
    const settled = render();
    const selected = find(settled, (node) =>
        Boolean((node.props.selection as { selected?: boolean } | undefined)?.selected)
    );
    assert.equal((selected.props.board as { id: string }).id, boards[1].collage.id);
    assert.equal(selected.props.suppressHover, false);
});

test("an inactive Continue deck card follows the pointer and is promoted on release instead of navigating", (t) => {
    const reset = hooks(t);
    const boards = [1, 2].map((boardId) =>
        toSelectionBoard({
            boardId,
            title: `Journey ${boardId}`,
            status: "published",
            source: "owned",
            updatedAt: "2026-10-20",
            coverImageUrl: null
        })
    );
    const selected = { index: 0 };
    const render = () => {
        reset();
        return BoardSelectionGallery({
            boards,
            selected: boards[selected.index],
            onSelect: (id) => {
                selected.index = id - 1;
            },
            onRetry() {}
        });
    };
    const stage = find(render(), (node) => typeof node.props.onPan === "function");
    invoke(stage, "onPointerDown", { target: { closest: () => ({ getAttribute: () => "2" }) } });
    const info = { offset: { x: -130, y: 15 }, velocity: { x: 0, y: 0 } };
    invoke(stage, "onPan", {}, info);
    const moving = find(render(), (node) => node.props["data-selection-card"] === 2);
    assert.equal((moving.props.animate as { x: number }).x, -130);
    invoke(
        find(render(), (node) => typeof node.props.onPanEnd === "function"),
        "onPanEnd",
        {},
        info
    );
    assert.equal(selected.index, 1);
});
