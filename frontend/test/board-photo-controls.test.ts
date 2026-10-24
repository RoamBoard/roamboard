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

test("photo strip offers named previous and next controls around an accessible draggable image carousel", () => {
    const { markup } = capture(() => BoardPhotoStrip({ label: "Board uploads", children: null }));
    assert.match(markup, /aria-roledescription="carousel"/);
    assert.match(markup, /<ul[^>]*aria-label="Board uploads"/);
    assert.match(markup, /<button[^>]*aria-label="Previous board uploads"/);
    assert.match(markup, /<button[^>]*aria-label="Next board uploads"/);
    assert.match(markup, /aria-label="Board uploads navigation"/);
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
    assert.match(markup, /Crop cover/);
    assert.match(markup, /Previous board cover photos/);
    const strip = controls.find((node) => node.type === BoardPhotoStrip);
    assert.ok(strip);
    const choices = Children.toArray(strip.props.children).flatMap(nodes);
    const secondPhoto = choices.find((node) => node.props["aria-label"] === "Use photo 2 as Board cover");
    assert.ok(secondPhoto);
    secondPhoto.props.onClick?.();
    assert.deepEqual(selected, [2]);
});
