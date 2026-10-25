import assert from "node:assert/strict";
import test from "node:test";
import React, {
    Children,
    createElement,
    isValidElement,
    type ReactNode,
    type ReactElement,
    type ComponentProps
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BoardCreationPreview from "../src/components/features/boards/BoardCreationPreview";
import BoardPhotoStrip from "../src/components/features/boards/BoardPhotoStrip";
import CroppedPhoto from "../src/components/images/CroppedPhoto";
import BoardCreator from "../src/components/features/boards/BoardCreator";
import BoardPreviewSection from "../src/components/features/boards/BoardPreviewSection";
import { toBoardWrite } from "../src/lib/board-creator-api";
import type { BoardCreatorPayload, BoardImageDraft, BoardPinDraft } from "../src/types/board-creator";

type Props = {
    children?: ReactNode;
    src?: string;
    alt?: string;
    open?: boolean;
    onClick?: () => void;
    "aria-label"?: string;
};
function nodes(node: ReactNode): ReactElement<Props>[] {
    if (!isValidElement<Props>(node)) return [];
    return [node, ...Children.toArray(node.props.children).flatMap(nodes)];
}
function text(node: ReactNode): string {
    if (Array.isArray(node)) return node.map(text).join("");
    return typeof node === "string" || typeof node === "number"
        ? String(node)
        : isValidElement<Props>(node)
          ? text(node.props.children)
          : "";
}
function photo(id: string, pinId: string | null, order: number, publicId = id): BoardImageDraft {
    return {
        id,
        pinId,
        publicId,
        source: "unsplash",
        url: `https://images.unsplash.com/${publicId}`,
        thumbnailUrl: `https://images.unsplash.com/${publicId}?w=320`,
        alt: id,
        width: 1600,
        height: 1200,
        capturedAt: null,
        latitude: null,
        longitude: null,
        order: 0,
        activityOrder: order,
        credit: "Photographer",
        creditUrl: "https://unsplash.com/@photographer",
        sourceUrl: `https://unsplash.com/photos/${publicId}`
    };
}
function pin(id: string, time: string, order: number): BoardPinDraft {
    return {
        id,
        title: id,
        time,
        order,
        description: id === "Late" ? "A full note that must remain available. ".repeat(8) : "An early stop",
        category: "museum",
        source: "manual",
        location: {
            name: `${id} Museum`,
            address: "Museum address",
            latitude: 59.3,
            longitude: 18.1,
            city: "Stockholm",
            country: "Sweden",
            countryCode: "SWE",
            mapboxId: null
        }
    };
}

for (const removed of ["shared-cover", "other-photo"] as const) {
    test(`removing ${removed} only changes the owning activity's selected cover`, (context) => {
        const cover = { source: "unsplash", providerImageId: "shared" } as const;
        const images = [
            photo("shared-cover", "first", 0, "shared"),
            photo("other-photo", "first", 1),
            photo("second-first", "second", 0),
            photo("second-cover", "second", 1, "shared")
        ];
        const days = [
            {
                id: "day",
                dayNumber: 1,
                date: null,
                pins: [
                    { ...pin("first", "09:00", 0), coverPhoto: cover },
                    { ...pin("second", "10:00", 1), coverPhoto: cover }
                ]
            }
        ];
        const originalUseState = React.useState;
        const seed = { images: false };
        context.mock.method(React, "useState", ((initial?: unknown) => {
            const value = typeof initial === "function" ? initial() : initial;
            if (Array.isArray(value) && value.length === 0 && !seed.images) {
                seed.images = true;
                return originalUseState(images);
            }
            return originalUseState(Array.isArray(value) && value[0]?.pins ? days : value);
        }) as typeof React.useState);
        const state: { removed: boolean; board?: BoardCreatorPayload } = { removed: false };
        function Probe() {
            seed.images = false;
            const tree = BoardCreator({ initialMode: "scratch" });
            const preview = nodes(tree).find((node) => node.type === BoardPreviewSection) as
                ReactElement<ComponentProps<typeof BoardPreviewSection>> | undefined;
            assert.ok(preview);
            state.board = preview.props.board;
            if (!state.removed) {
                state.removed = true;
                preview.props.onRemovePhoto?.(removed);
            }
            return null;
        }
        renderToStaticMarkup(createElement(Probe));
        assert.ok(state.board);
        const activities = state.board.days[0].pins;
        assert.deepEqual(activities[0].coverPhoto, removed === "shared-cover" ? null : cover);
        assert.deepEqual(activities[1].coverPhoto, cover);
        assert.ok(!state.board.images.some((image) => image.id === removed));
        assert.ok(state.board.images.some((image) => image.id === "second-cover"));
        const savedActivities = toBoardWrite(state.board, []).days[0].activities;
        assert.deepEqual(savedActivities[1].coverPhoto, cover, "Saving must retain the second activity's chosen cover");
    });
}

test("full Board review uses complete day galleries in saved activity/photo order with compact editable rows", () => {
    const expected = ["late-0", "late-1", "late-2", "late-3", "early-0", "early-1", "early-2"];
    const photos = [
        photo("late-0", "Late", 0, "shared"),
        photo("late-1", "Late", 1),
        photo("late-2", "Late", 2),
        photo("late-3", "Late", 3),
        photo("early-0", "Early", 0),
        photo("early-1", "Early", 1, "shared"),
        photo("early-2", "Early", 2)
    ];
    const board: BoardCreatorPayload = {
        title: "Saved order trip",
        description: "",
        status: "draft",
        visibility: "friends",
        coverImageId: null,
        tags: [],
        days: [
            { id: "one", dayNumber: 1, date: null, pins: [pin("Late", "20:00", 0), pin("Early", "08:00", 1)] },
            { id: "two", dayNumber: 2, date: null, pins: [] }
        ],
        images: [
            photos[5],
            photos[3],
            photos[1],
            photos[6],
            photos[0],
            photos[4],
            photos[2],
            photo("unassigned", null, 0)
        ]
    };
    const edits: string[] = [];
    const capture: { tree?: ReactNode } = {};
    function Probe() {
        capture.tree = BoardCreationPreview({
            board,
            onEditActivity: (id) => edits.push(id),
            onRemovePhoto() {},
            onUpdatePhoto() {}
        });
        return nodes(capture.tree).find((node) => node.type === "details") as ReactNode;
    }
    const markup = renderToStaticMarkup(createElement(Probe));
    const tree = nodes(capture.tree);
    const review = tree.find(
        (node) => node.type === "details" && text(node.props.children).includes("Review full Board")
    );
    assert.ok(review, "The default-open review must be named Review full Board");
    assert.equal(review.props.open, true);
    const day = nodes(review).find(
        (node) =>
            node.type === "section" &&
            nodes(node).some((child) => child.type === "h3" && text(child.props.children) === "Day 1")
    );
    assert.ok(day);
    const gallery = nodes(day).find(
        (node) => node.type === "ul" && nodes(node).some((child) => child.type === CroppedPhoto)
    );
    assert.ok(gallery, "Each day needs a wrapping photo list ahead of its activity list");
    const galleryPhotos = nodes(gallery).filter((node) => node.type === CroppedPhoto);
    assert.deepEqual(
        galleryPhotos.map((node) => node.props.alt),
        expected,
        "Every photo remains in saved order, including more than three and repeated provider identities"
    );
    assert.equal(
        galleryPhotos.filter((node) => node.props.src?.includes("/shared?")).length,
        2,
        "A shared provider photo in separate activities remains two placements"
    );
    assert.ok(
        !nodes(day).some((node) => node.type === BoardPhotoStrip),
        "Day review must not nest per-activity carousels"
    );
    const list = nodes(day).find((node) => node.type === "ol");
    assert.ok(list);
    const activityButtons = nodes(list).filter(
        (node) => node.type === "button" && ["Late", "Early"].includes(text(node.props.children))
    );
    assert.deepEqual(
        activityButtons.map((node) => text(node.props.children)),
        ["Late", "Early"]
    );
    activityButtons[1].props.onClick?.();
    assert.deepEqual(edits, ["Early"]);
    assert.ok(text(list).includes(board.days[0].pins[0].description), "Compact rows retain full notes for review");
    for (const card of Children.toArray(gallery.props.children)) {
        assert.ok(
            text(card).includes("Late") || text(card).includes("Early"),
            "Every photo exposes its activity title to touch, hover and focus users"
        );
        assert.ok(
            nodes(card).some((node) => node.type === "button" && /Enlarge/.test(node.props["aria-label"] ?? "")),
            "Every gallery placement opens the shared zoom viewer"
        );
    }
    assert.match(markup, /Other Board photos/);
    assert.doesNotMatch(text(day), /unassigned/);
});
