import assert from "node:assert/strict";
import test from "node:test";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ActivityEditorDialog from "../src/components/features/boards/ActivityEditorDialog";
import { fromBoardDocument, toBoardWrite, type BoardDocument } from "../src/lib/board-creator-api";
import { publicationErrors } from "../src/lib/board-editor-safety";
import { CarouselNext, CarouselPrevious } from "../src/components/ui/carousel";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { BoardCreatorPayload, BoardImageDraft, BoardPinDraft } from "../src/types/board-creator";

type Control = { children?: ReactNode; "aria-label"?: string; onClick?: () => void };
function controls(node: ReactNode): Array<{ type: unknown; props: Control }> {
    if (!isValidElement<Control>(node)) return [];
    return [node, ...Children.toArray(node.props.children).flatMap(controls)];
}

test("chosen day colors survive saving, reopening and saving again without assigning old days a new color", () => {
    const draft: BoardCreatorPayload = {
        title: "Weekend",
        description: "",
        status: "draft",
        visibility: "collaborators",
        coverImageId: null,
        tags: [],
        images: [],
        days: [
            { id: "one", dayNumber: 1, date: null, color: "#c58e76", pins: [] },
            { id: "two", dayNumber: 2, date: null, color: null, pins: [] },
            { id: "old-day", dayNumber: 3, date: null, pins: [] }
        ]
    };
    const write = toBoardWrite(draft, []);
    const document: BoardDocument = {
        ...write,
        boardId: 42,
        revision: 1,
        author: { username: "owner", bio: "", photo: null },
        permissions: { canEditContent: true, canManageBoard: true },
        tags: [],
        images: [],
        days: write.days.map((day, index) => ({ ...day, dayId: index + 1, activities: [] })),
        createdAt: "2026-10-25T12:00:00Z",
        updatedAt: "2026-10-25T12:00:00Z"
    };
    const reopened = fromBoardDocument(document);
    assert.deepEqual(
        reopened.days.map((day) => day.color),
        ["#c58e76", null, null]
    );
    assert.deepEqual(
        toBoardWrite({ ...draft, ...reopened }, []).days.map((day) => day.color),
        ["#c58e76", null, null]
    );
});

test("shared carousel exposes both directional arrows and enables each only when that direction is available", (context) => {
    const steps: string[] = [];
    const position = {
        scrollPrev: () => steps.push("previous"),
        scrollNext: () => steps.push("next"),
        canScrollPrev: false,
        canScrollNext: true
    };
    context.mock.method(React, "useContext", () => position);
    const previous = CarouselPrevious({});
    const next = CarouselNext({});
    assert.equal(previous.type, "button");
    assert.equal(next.type, "button");
    assert.equal(previous.props.disabled, true);
    assert.equal(next.props.disabled, false);
    assert.ok(controls(previous).some((node) => node.type === ArrowLeft));
    assert.ok(controls(next).some((node) => node.type === ArrowRight));
    next.props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    position.canScrollPrev = true;
    const middlePrevious = CarouselPrevious({});
    assert.equal(middlePrevious.props.disabled, false);
    middlePrevious.props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    position.canScrollNext = false;
    assert.equal(CarouselNext({}).props.disabled, true);
    assert.deepEqual(steps, ["next", "previous"]);
});

test("removing an activity photo stages detachment and saving keeps the original Board upload", () => {
    const pin: BoardPinDraft = {
        id: "walk",
        title: "Morning walk",
        description: "",
        order: 0,
        time: "09:00",
        category: "activity",
        source: "manual",
        location: null,
        coverImageId: 42
    };
    const image: BoardImageDraft = {
        id: "original-upload",
        uploadedImageId: 42,
        publicId: "42",
        pinId: pin.id,
        source: "upload",
        url: "/photo/42",
        thumbnailUrl: "/photo/42/thumb",
        width: 1200,
        height: 800,
        capturedAt: null,
        latitude: null,
        longitude: null,
        order: 0,
        credit: null,
        creditUrl: null,
        sourceUrl: null
    };
    const board = { images: [image], pin };
    const deleted: string[] = [];
    const capture: { controls: ReturnType<typeof controls>; clicked: boolean } = { controls: [], clicked: false };
    function Probe() {
        const wrapper = ActivityEditorDialog({
            pin,
            images: [image],
            remainingUploads: 29,
            onClose() {},
            onDelete() {},
            onSave: (saved) => {
                board.pin = saved;
            },
            onAddImage: (added) => {
                board.images.push(added);
            },
            onRemoveImage: (id) => {
                deleted.push(id);
                board.images = board.images.filter((item) => item.id !== id);
            },
            onAssignImage: (id, pinId) => {
                board.images = board.images.map((item) => (item.id === id ? { ...item, pinId } : item));
            },
            onSetCover() {},
            onReorderImage() {}
        });
        assert.equal(typeof wrapper.type, "function");
        const tree = (wrapper.type as (props: unknown) => ReactNode)(wrapper.props);
        capture.controls = controls(tree);
        if (!capture.clicked) {
            capture.clicked = true;
            const remove = capture.controls.find((node) =>
                /^(Delete|Remove|Detach) (image|photo) 1$/i.test(node.props["aria-label"] ?? "")
            );
            assert.ok(remove, "Activity photos need an accessible remove action");
            remove.props.onClick?.();
            assert.deepEqual(board.images, [image], "Attachment edits stay staged before Save activity");
        }
        return tree;
    }
    renderToStaticMarkup(createElement(Probe));
    const save = capture.controls.find((node) => node.type === "button" && node.props.children === "Save activity");
    assert.ok(save);
    save.props.onClick?.();
    assert.deepEqual(deleted, [], "Removing from an activity must never call Board photo deletion");
    assert.equal(board.images.length, 1);
    assert.equal(board.images[0].pinId, null);
    const write = toBoardWrite(
        {
            title: "Our trip",
            description: "",
            status: "draft",
            visibility: "collaborators",
            coverImageId: 42,
            tags: [],
            images: board.images,
            days: [{ id: "day", dayNumber: 1, date: null, pins: [board.pin] }]
        },
        []
    );
    assert.deepEqual(write.imageIds, [42]);
    assert.equal(write.coverImageId, 42, "The detached photo remains available as the Board cover");
    assert.deepEqual(write.days[0].activities[0].uploadedImageIds, []);
    assert.equal(write.days[0].activities[0].coverImageId, null);
});

test("publishing exposes every missing field in chapter order so later chapters retain their errors", () => {
    const board: BoardCreatorPayload = {
        title: "   ",
        description: "",
        status: "draft",
        visibility: "public",
        coverImageId: null,
        tags: [],
        images: [],
        days: [{ id: "day", dayNumber: 1, date: null, pins: [] }]
    };
    const original = structuredClone(board);
    const errors = publicationErrors(board);
    assert.deepEqual(
        errors.map((error) => error.field),
        ["board-title", "board-destination", "day-plan"]
    );
    assert.ok(errors.every((error) => error.message.trim().length > 10));
    assert.match(errors[0].message, /title/i);
    assert.match(errors[1].message, /destination/i);
    assert.match(errors[2].message, /activit/i);
    assert.deepEqual(board, original, "Validation must preserve the unfinished draft");
    board.title = "Our weekend";
    assert.equal(publicationErrors(board)[0].field, "board-destination");
    board.destination = {
        kind: "city",
        name: "Stockholm",
        address: "Stockholm, Sweden",
        latitude: 59.33,
        longitude: 18.06,
        country: "Sweden",
        countryCode: "SWE",
        city: "Stockholm",
        mapboxId: null
    };
    assert.deepEqual(
        publicationErrors(board).map((error) => error.field),
        ["day-plan"]
    );
    board.days[0].pins.push({
        id: "walk",
        title: "Walk",
        description: "",
        order: 0,
        time: "",
        category: "activity",
        source: "manual",
        location: null
    });
    assert.equal(
        publicationErrors(board)[0]?.field,
        "day-plan",
        "An itinerary-only activity does not satisfy the published location requirement"
    );
    board.days[0].pins[0].location = board.destination;
    assert.deepEqual(publicationErrors(board), []);
});
