import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BoardPhotoStrip from "../src/components/features/boards/BoardPhotoStrip";
import BoardCoverDialog from "../src/components/features/boards/BoardCoverDialog";
import type { BoardImageDraft } from "../src/types/board-creator";

type Props = {
    children?: ReactNode;
    onClick?: () => void;
    ref?: { current: unknown };
    "aria-label"?: string;
};
function nodes(node: ReactNode): Array<{ type: unknown; props: Props }> {
    if (!isValidElement<Props>(node)) return [];
    return [node, ...Children.toArray(node.props.children).flatMap(nodes)];
}
function capture(render: () => ReactNode) {
    const holder: { tree?: ReactNode } = {};
    function Probe() {
        holder.tree = render();
        return holder.tree;
    }
    const markup = renderToStaticMarkup(createElement(Probe));
    return { markup, controls: nodes(holder.tree) };
}

test("photo-strip arrows scroll the image list in both directions and honor reduced motion", () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
    const calls: ScrollToOptions[] = [];
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: { matchMedia: () => ({ matches: true }) }
    });
    try {
        const { controls } = capture(() => BoardPhotoStrip({ label: "Board uploads", children: null }));
        const list = controls.find((node) => node.type === "ul");
        assert.ok(list?.props.ref);
        list.props.ref.current = { clientWidth: 400, scrollBy: (options: ScrollToOptions) => calls.push(options) };
        controls.find((node) => node.props["aria-label"] === "Next board uploads")?.props.onClick?.();
        controls.find((node) => node.props["aria-label"] === "Previous board uploads")?.props.onClick?.();
        assert.equal(calls.length, 2);
        assert.ok(calls[0].left! > 0);
        assert.ok(calls[1].left! < 0);
        assert.ok(calls.every((call) => call.behavior === "instant"));
    } finally {
        if (previous) Object.defineProperty(globalThis, "window", previous);
        else Reflect.deleteProperty(globalThis, "window");
    }
});

test("cover picker offers every upload including activity photos, selects a cover and exposes crop controls", () => {
    const images: BoardImageDraft[] = [1, 2].map((id) => ({
        id: String(id),
        uploadedImageId: id,
        publicId: String(id),
        pinId: id === 1 ? "activity" : null,
        source: "upload",
        url: `/image/${id}`,
        thumbnailUrl: `/thumb/${id}`,
        width: 100,
        height: 100,
        capturedAt: null,
        latitude: null,
        longitude: null,
        order: id,
        credit: null,
        creditUrl: null,
        sourceUrl: null
    }));
    const selected: number[] = [];
    const { markup, controls } = capture(() =>
        BoardCoverDialog({
            images,
            coverImageId: 1,
            onSelect: (id) => selected.push(id),
            onUpload() {},
            onClose() {}
        })
    );
    assert.match(markup, /Selected Board cover/);
    assert.match(markup, /Crop \/ resize cover/);
    assert.match(markup, /Previous board cover photos/);
    const strip = controls.find((node) => node.type === BoardPhotoStrip);
    assert.ok(strip);
    const choices = Children.toArray(strip.props.children).flatMap(nodes);
    const secondPhoto = choices.find((node) => node.props["aria-label"] === "Use photo 2 as Board cover");
    assert.ok(secondPhoto);
    secondPhoto.props.onClick?.();
    assert.deepEqual(selected, [2]);
});
