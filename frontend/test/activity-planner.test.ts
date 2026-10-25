import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import AddActivityDialog from "../src/components/features/boards/AddActivityDialog";
import ActivityEditorDialog from "../src/components/features/boards/ActivityEditorDialog";
import PlannerDayColumn from "../src/components/features/boards/PlannerDayColumn";
import BoardPlanMap from "../src/components/features/boards/BoardPlanMap";
import ActivityLocationSearch, { locationDetails } from "../src/components/features/boards/ActivityLocationSearch";
import { searchBoardLocationProvider, type MapboxSearchResult } from "../src/lib/providers";
import { findActivityPhoto as requestActivityPhoto } from "../src/lib/providers";
import { fillActivityFromPhoto, photoActivityLocation } from "../src/lib/activity-photo";
import NewBoardPage from "../src/app/boards/new/page";
import type { BoardDayDraft, BoardImageDraft, BoardPinDraft } from "../src/types/board-creator";

const activity: BoardPinDraft = {
    id: "beach",
    title: "Bali Beach",
    time: "11:30",
    description: "Our beach stop",
    category: "beach",
    source: "photo",
    coverImageId: 31,
    order: 0,
    location: {
        name: "Bali Beach",
        address: "Bali Beach, Badung, Bali",
        latitude: -8.8,
        longitude: 115.1,
        country: "Indonesia",
        countryCode: "IDN",
        city: "Badung",
        mapboxId: "geoapify:beach"
    }
};
const day: BoardDayDraft = { id: "first", dayNumber: 1, date: null, pins: [activity] };

type ElementProps = {
    children?: ReactNode;
    onClick?: () => void | Promise<void>;
    onChange?: (event: { target: { value: string } }) => void;
    onKeyDown?: (event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => void;
    onSubmit?: (event: { preventDefault: () => void }) => void;
    className?: string;
    onWheel?: unknown;
    "aria-label"?: string;
    disabled?: boolean;
};
function elements(node: ReactNode): Array<{ type: unknown; props: ElementProps }> {
    if (!isValidElement<ElementProps>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(elements)];
}
function capture(render: () => ReactNode, afterRender?: (nodes: ReturnType<typeof elements>) => void) {
    const holder: { tree?: ReactNode } = {};
    function Probe() {
        const wrapper = render();
        holder.tree =
            isValidElement(wrapper) &&
            typeof wrapper.type === "function" &&
            wrapper.type.name === "ActivityEditorContent"
                ? (wrapper.type as (props: unknown) => ReactNode)(wrapper.props)
                : wrapper;
        afterRender?.(elements(holder.tree));
        return holder.tree;
    }
    const markup = renderToStaticMarkup(createElement(Probe));
    return { markup, nodes: elements(holder.tree) };
}
function column(overrides: Partial<ComponentProps<typeof PlannerDayColumn>> = {}) {
    return {
        day,
        dayIndex: 0,
        days: [day],
        images: [],
        disabled: false,
        onOpenPin() {},
        onAdd() {},
        onRemoveDay() {},
        onMovePin() {},
        onUpdatePin() {},
        onColorChange() {},
        dragTarget: null,
        onDragTargetChange() {},
        ...overrides
    };
}

test("a day's blank surface is a native add button and reviewing a photo opens its activity", () => {
    const events: string[] = [];
    const result = capture(() =>
        PlannerDayColumn(column({ onAdd: () => events.push("add"), onOpenPin: (id) => events.push(id) }))
    );
    const add = result.nodes.find(
        (node) => node.type === "button" && node.props["aria-label"] === "Add an activity to day 1"
    );
    assert.ok(add);
    assert.equal(add.props.children, undefined);
    add.props.onClick?.();
    const review = result.nodes.find(
        (node) => node.type === "button" && node.props["aria-label"] === "Edit Bali Beach"
    );
    assert.ok(review);
    assert.ok(!result.markup.includes("Review activity"));
    review.props.onClick?.();
    assert.deepEqual(events, ["add", "beach"]);
    assert.ok(result.nodes.every((node) => node.props.onWheel === undefined));
    assert.ok(result.nodes.every((node) => !/overflow-y-auto|max-h-\[|h-\[.*vh/.test(node.props.className ?? "")));
});

test("new activities offer location, time, category and note without manual coordinate controls", () => {
    const added: unknown[] = [];
    const { markup, nodes } = capture(() => {
        const dialog = AddActivityDialog({ day, onClose() {}, onAdd: (...args) => added.push(args) });
        assert.ok(isValidElement<ComponentProps<typeof ActivityEditorDialog>>(dialog));
        return ActivityEditorDialog(dialog.props);
    });
    for (const label of ["Search location", "Time", "Category", "Note"]) assert.ok(markup.includes(label));
    assert.doesNotMatch(markup, /Latitude|Longitude|Google Places|type="number"/);
    assert.match(markup, /Add photos/);
    assert.doesNotMatch(markup, /Delete activity/);
    const submit = nodes.find((node) => node.type === "button" && node.props.children === "Add to Day 1");
    assert.ok(submit);
    submit.props.onClick?.();
    assert.deepEqual(added, [], "An activity still needs a title even when it has no selected location");
});

test("saving an existing activity preserves raw photo GPS and photo source until explicitly changed", () => {
    const saved: BoardPinDraft[] = [];
    const closed: boolean[] = [];
    const original = structuredClone(activity);
    const { nodes, markup } = capture(() =>
        ActivityEditorDialog({
            pin: activity,
            images: [],
            remainingUploads: 30,
            onClose: () => closed.push(true),
            onSave: (pin) => saved.push(pin),
            onDelete() {},
            onAddImage() {},
            onAssignImage() {},
            onReorderImage() {}
        })
    );
    const save = nodes.find((node) => node.type === "button" && node.props.children === "Save activity");
    assert.ok(save);
    save.props.onClick?.();
    assert.deepEqual(saved, [original]);
    assert.deepEqual(closed, [true]);
    assert.deepEqual(activity, original);
    assert.doesNotMatch(markup, /Latitude|Longitude|type="number"/);
    const labelId = /role="dialog"[^>]*aria-labelledby="([^"]+)"/.exec(markup)?.[1];
    assert.ok(labelId);
    assert.ok(markup.includes(`id="${labelId}"`), "The activity editor must have an accessible heading");
});

test("Escape dismisses an edited location search before it can close the activity dialog", () => {
    const actions: string[] = [];
    const stage = { value: 0 };
    const result = capture(
        () => ActivityLocationSearch({ value: null, onSelect() {} }),
        (nodes) => {
            const input = nodes.find((node) => node.type === "input");
            assert.ok(input);
            if (stage.value === 0) {
                stage.value = 1;
                input.props.onChange?.({ target: { value: "Bali" } });
            } else if (stage.value === 1) {
                stage.value = 2;
                input.props.onKeyDown?.({
                    key: "Escape",
                    preventDefault: () => actions.push("prevent"),
                    stopPropagation: () => actions.push("stop")
                });
            }
        }
    );
    assert.deepEqual(actions, ["prevent", "stop"]);
    assert.doesNotMatch(result.markup, /Finding places|No places found/);
    const input = result.nodes.find((node) => node.type === "input");
    input?.props.onKeyDown?.({
        key: "Escape",
        preventDefault: () => actions.push("unexpected prevent"),
        stopPropagation: () => actions.push("unexpected stop")
    });
    assert.deepEqual(actions, ["prevent", "stop"], "A second Escape should remain available to the containing dialog");
});

test("a disabled location search disables its input and change-location control", () => {
    const { nodes } = capture(() =>
        ActivityLocationSearch({ value: activity.location, disabled: true, onSelect() {} })
    );
    assert.equal(nodes.find((node) => node.type === "input")?.props.disabled, true);
    assert.equal(nodes.find((node) => node.props["aria-label"] === "Change location")?.props.disabled, true);
});

test("activity editing omits removed photo refresh and day placement controls", () => {
    const { markup } = capture(() =>
        ActivityEditorDialog({
            pin: activity,
            images: [],
            remainingUploads: 30,
            onClose() {},
            onSave() {},
            onDelete() {},
            onAddImage() {},
            onAssignImage() {},
            onReorderImage() {}
        })
    );
    assert.doesNotMatch(markup, /Re-read photo location|Move earlier|Move later|Place a pin/);
});
test("the shared map starts on all days and offers day filters without requiring locations", () => {
    const markup = renderToStaticMarkup(
        createElement(BoardPlanMap, { days: [{ ...day, pins: [] }], onOpenActivity() {} })
    );
    assert.match(markup, /aria-label="Show activities by day"/);
    assert.match(markup, /aria-pressed="true"[^>]*>All days<\/button>/);
    assert.match(markup, /Your activities will take shape here/);
});

test("location search calls the real backend helper with optional proximity and preserves provider relevance order", async (context) => {
    const requests: Array<{ url: URL; init?: RequestInit }> = [];
    const places: MapboxSearchResult[] = [
        {
            id: "second-category",
            name: "Nearby Cafe",
            address: "Badung",
            latitude: -8.8,
            longitude: 115.1,
            placeType: "cafe",
            context: [],
            country: "Indonesia",
            countryCode: "IDN",
            city: "Badung"
        },
        {
            id: "first-category",
            name: "Farther Landmark",
            address: "Bali",
            latitude: -8.7,
            longitude: 115.2,
            placeType: "landmark",
            context: [],
            country: "Indonesia",
            countryCode: "IDN",
            city: "Badung"
        }
    ];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        requests.push({ url: new URL(String(input)), init });
        return Response.json({ data: places });
    });
    const signal = new AbortController().signal;
    assert.deepEqual(
        await searchBoardLocationProvider("restaurant", signal, { latitude: -8.8, longitude: 115.1 }),
        places
    );
    assert.deepEqual(await searchBoardLocationProvider("Eiffel Tower Paris", signal), places);
    assert.equal(requests[0]?.url.pathname, "/api/v1/providers/locations/search");
    assert.equal(requests[0]?.url.searchParams.get("q"), "restaurant");
    assert.equal(requests[0]?.url.searchParams.get("latitude"), "-8.8");
    assert.equal(requests[0]?.url.searchParams.get("longitude"), "115.1");
    assert.equal(requests[0]?.init?.signal, signal);
    assert.equal(requests[0]?.init?.credentials, "include");
    assert.equal(requests[1]?.url.searchParams.get("q"), "Eiffel Tower Paris");
    assert.equal(requests[1]?.url.searchParams.has("latitude"), false);
    assert.equal(requests[1]?.url.searchParams.has("longitude"), false);
});

test("location details omit duplicate place and area names", () => {
    assert.equal(locationDetails(activity.location!), "Badung, Bali, Indonesia");
});

test("uploaded metadata fills an empty activity using raw GPS while preserving existing user choices", () => {
    const blank: BoardPinDraft = {
        ...activity,
        location: null,
        title: "",
        time: "",
        category: "activity",
        source: "geoapify"
    };
    const image = { latitude: -8.8, longitude: 115.1, capturedAt: "2026-06-21T11:30:00Z" };
    const suggestion = {
        imageId: 31,
        category: "landmark" as const,
        warning: null,
        location: {
            id: "geoapify:temple",
            label: "Uluwatu Temple",
            detail: "Uluwatu Temple",
            address: "Badung, Bali",
            type: "landmark",
            latitude: -8.801,
            longitude: 115.102,
            city: "Badung",
            country: "Indonesia",
            countryCode: "IDN"
        }
    };
    const filled = fillActivityFromPhoto(blank, image, suggestion);
    assert.equal(filled.title, "Uluwatu Temple");
    assert.equal(filled.time, "11:30");
    assert.equal(filled.category, "landmark");
    assert.equal(filled.source, "photo");
    assert.equal(filled.location?.latitude, -8.8);
    assert.equal(filled.location?.longitude, 115.1);
    assert.equal(filled.description, blank.description);
    assert.deepEqual(fillActivityFromPhoto(activity, image, suggestion), activity);
    assert.equal(photoActivityLocation({ latitude: null, longitude: null }, suggestion), null);
    assert.equal(fillActivityFromPhoto(blank, { latitude: null, longitude: null, capturedAt: null }).time, "");
});

test("new activity media stays unassigned until the activity is saved", () => {
    const added: BoardImageDraft[] = [];
    const assigned: Array<[string, string | null]> = [];
    const saved: BoardPinDraft[] = [];
    const holder: { props?: ComponentProps<typeof ActivityEditorDialog> } = {};
    const stage = { uploaded: false };
    capture(() => {
        const dialog = ActivityEditorDialog(
            AddActivityDialog({
                day,
                onClose() {},
                onAdd: (_dayId, pin) => saved.push(pin),
                onAddImage: (image) => added.push(image),
                onAssignImage: (imageId, pinId) => assigned.push([imageId, pinId])
            }).props
        );
        holder.props = dialog.props;
        if (!stage.uploaded) {
            stage.uploaded = true;
            const image: BoardImageDraft = {
                id: "new-image",
                uploadedImageId: 31,
                pinId: dialog.props.pin.id,
                publicId: "31",
                source: "upload",
                url: "/photo",
                thumbnailUrl: "/photo/thumb",
                width: 0,
                height: 0,
                capturedAt: null,
                latitude: -8.8,
                longitude: 115.1,
                order: 0,
                credit: null,
                creditUrl: null,
                sourceUrl: null
            };
            dialog.props.onAddImage(image);
        }
        return dialog;
    });
    assert.equal(added[0]?.pinId, null);
    assert.deepEqual(saved, []);
    assert.deepEqual(assigned, []);
    assert.ok(holder.props);
    holder.props.onSave({ ...holder.props.pin, location: activity.location, title: "Bali Beach" });
    assert.equal(saved.length, 1);
    assert.deepEqual(assigned, [["new-image", holder.props.pin.id]]);
});

test("strict activity photo helpers separate discovery from persisted selection", async (context) => {
    const calls: Array<{ url: URL; init?: RequestInit }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: new URL(String(input)), init });
        return Response.json({ data: null });
    });
    const target = { name: "Uluwatu Temple", city: "Badung", country: "Indonesia", latitude: -8.8, longitude: 115.1 };
    assert.equal(await requestActivityPhoto(target), null);
    assert.equal(await requestActivityPhoto(target, undefined, true), null);
    assert.equal(calls[0]?.url.pathname, "/api/v1/providers/unsplash/activity-photo");
    assert.equal(calls[0]?.url.searchParams.get("name"), target.name);
    assert.equal(calls[0]?.url.searchParams.get("latitude"), "-8.8");
    assert.equal(calls[1]?.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), target);
    assert.ok(calls.every((call) => call.init?.credentials === "include"));
});

test("the image order chosen while creating an activity is preserved when its staged images are assigned", () => {
    const assigned: string[] = [];
    const holder: { props?: ComponentProps<typeof ActivityEditorDialog> } = {};
    const stage = { value: 0 };
    capture(() => {
        const dialog = ActivityEditorDialog(
            AddActivityDialog({
                day,
                onClose() {},
                onAdd() {},
                onAddImage() {},
                onAssignImage: (id) => assigned.push(id)
            }).props
        );
        holder.props = dialog.props;
        if (stage.value === 0) {
            stage.value = 1;
            for (const id of [1, 2]) {
                dialog.props.onAddImage({
                    id: `new-${id}`,
                    uploadedImageId: id,
                    pinId: dialog.props.pin.id,
                    publicId: String(id),
                    source: "upload",
                    url: `/photo/${id}`,
                    thumbnailUrl: `/photo/${id}`,
                    width: 0,
                    height: 0,
                    capturedAt: null,
                    latitude: null,
                    longitude: null,
                    order: id - 1,
                    credit: null,
                    creditUrl: null,
                    sourceUrl: null
                });
            }
        } else if (stage.value === 1) {
            stage.value = 2;
            dialog.props.onReorderImage(dialog.props.pin.id, "new-2", -1);
        }
        return dialog;
    });
    assert.ok(holder.props);
    holder.props.onSave({ ...holder.props.pin, location: activity.location, title: "Bali Beach" });
    assert.deepEqual(assigned, ["new-2", "new-1"]);
});

test("the map sits between planning and details with five unnumbered navigation chapters", async () => {
    const page = await NewBoardPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(
        createElement(
            AppRouterContext.Provider,
            {
                value: {
                    bfcacheId: "activity-planner-test",
                    back() {},
                    forward() {},
                    refresh() {},
                    push() {},
                    replace() {},
                    prefetch() {}
                }
            },
            page.props.children
        )
    );
    const chapterIds = ["board-basics", "day-plan", "board-map", "details-discovery", "board-preview"];
    for (const [index, id] of chapterIds.entries()) {
        const offset = markup.indexOf(`id="${id}"`);
        assert.ok(offset >= 0, `Chapter ${id} should exist`);
        if (index) assert.ok(offset > markup.indexOf(`id="${chapterIds[index - 1]}"`));
    }
    assert.equal((markup.match(/id="board-map"/g) ?? []).length, 1);
    assert.match(markup, /href="#board-map"/);
    assert.match(markup, />Overview</);
    assert.doesNotMatch(markup, /href="#publish"/);
});
