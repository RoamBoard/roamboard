import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import DayPlanner from "../src/components/features/boards/DayPlanner";
import ActivityCategoryPicker from "../src/components/features/boards/ActivityCategoryPicker";
import { movePlannerPin, reorderPlannerPin } from "../src/lib/board-planner";
import { toBoardWrite } from "../src/lib/board-creator-api";
import type { BoardCreatorPayload, BoardDayDraft, BoardImageDraft, BoardPinDraft } from "../src/types/board-creator";

function pin(id: string, time: string, order: number): BoardPinDraft {
    return {
        id,
        serverActivityId: id.charCodeAt(0),
        coverImageId: 501,
        time,
        order,
        title: `Visit ${id}`,
        description: `Notes for ${id}`,
        category: "museum",
        source: "photo",
        location: {
            name: "Museum",
            address: "Museum street",
            latitude: 59.32,
            longitude: 18.06,
            country: "Sweden",
            countryCode: "SWE",
            city: "Stockholm",
            mapboxId: "location-123"
        }
    };
}

function days(): BoardDayDraft[] {
    return [
        {
            id: "one",
            serverDayId: 101,
            dayNumber: 1,
            date: "2026-10-20",
            pins: [pin("A", "12:00", 0), pin("B", "09:00", 1), pin("C", "18:00", 2)]
        },
        { id: "two", serverDayId: 102, dayNumber: 2, date: null, pins: [pin("D", "10:00", 0), pin("E", "17:00", 1)] },
        { id: "three", serverDayId: 103, dayNumber: 3, date: null, pins: [] }
    ];
}

function freeze<T>(value: T): T {
    if (value !== null && typeof value === "object") {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}

function assertConsecutiveOrder(result: BoardDayDraft[]) {
    for (const day of result)
        assert.deepEqual(
            day.pins.map((item) => item.order),
            day.pins.map((_, index) => index)
        );
}

test("earlier and later activity moves follow displayed order, keep times and preserve all activity metadata", () => {
    const original = freeze(days());
    const before = structuredClone(original);
    const earlier = reorderPlannerPin(original, "C", -1);
    assert.deepEqual(
        earlier[0].pins.map((item) => item.id),
        ["A", "C", "B"]
    );
    assert.deepEqual(earlier[0].pins[1], { ...original[0].pins[2], order: 1 });
    assertConsecutiveOrder(earlier);
    const later = reorderPlannerPin(earlier, "C", 1);
    assert.deepEqual(later, before);
    assert.deepEqual(original, before);
});

test("keyboard ordering is preserved as canonical API positions even when activity times disagree", () => {
    const moved = reorderPlannerPin(freeze(days()), "A", 1);
    const draft: BoardCreatorPayload = {
        title: "Museum trip",
        description: "",
        status: "draft",
        visibility: "collaborators",
        coverImageId: 501,
        tags: [],
        days: moved,
        images: [image(501, "A")]
    };
    const write = toBoardWrite(draft, []);
    assert.deepEqual(
        write.days[0].activities.map((activity) => [activity.activityId, activity.position, activity.activityTime]),
        [
            [66, 0, "09:00"],
            [65, 1, "12:00"],
            [67, 2, "18:00"]
        ]
    );
    const activity = write.days[0].activities[1];
    assert.deepEqual(activity.uploadedImageIds, [501]);
    assert.equal(activity.coverImageId, 501);
    assert.equal(activity.locationConfirmed, true);
    assert.equal(activity.category, "museum");
    assert.equal(activity.note, "Notes for A");
    assert.equal(activity.location?.externalPlaceId, "location-123");
    assert.equal(write.days[0].dayId, 101);
    assert.equal(write.days[0].date, "2026-10-20");
    assert.deepEqual(write.days[2].activities, []);
});

test("explicit cross-day insertion preserves supplied position, original time and unrelated days", () => {
    const original = freeze(days());
    const result = movePlannerPin(original, "B", "two", "09:00", 1);
    assert.deepEqual(
        result[0].pins.map((item) => item.id),
        ["A", "C"]
    );
    assert.deepEqual(
        result[1].pins.map((item) => item.id),
        ["D", "B", "E"]
    );
    assert.deepEqual(result[1].pins[1], { ...original[0].pins[1], order: 1 });
    assert.deepEqual(result[2], original[2]);
    assert.equal(result.flatMap((day) => day.pins).filter((item) => item.id === "B").length, 1);
    assertConsecutiveOrder(result);
    assert.deepEqual(original, days());
});

test("an explicit same-day position moves the activity without duplicating it or sorting its time", () => {
    const original = freeze(days());
    const result = movePlannerPin(original, "C", "one", "18:00", 0);
    assert.deepEqual(
        result[0].pins.map((item) => item.id),
        ["C", "A", "B"]
    );
    assert.equal(result[0].pins[0].time, "18:00");
    assertConsecutiveOrder(result);
});

test("drag-style movement without a supplied position still orders the destination by its new time", () => {
    const original = freeze(days());
    const result = movePlannerPin(original, "C", "two", "14:30");
    assert.deepEqual(
        result[1].pins.map((item) => [item.id, item.time]),
        [
            ["D", "10:00"],
            ["C", "14:30"],
            ["E", "17:00"]
        ]
    );
    assert.deepEqual(result[1].pins[1], { ...original[0].pins[2], time: "14:30", order: 1 });
    assertConsecutiveOrder(result);
});

test("moving into an empty day retains the day and its persisted identity", () => {
    const original = freeze(days());
    const result = movePlannerPin(original, "A", "three", "12:00", 0);
    assert.deepEqual(result[2], { ...original[2], pins: [{ ...original[0].pins[0], order: 0 }] });
    assert.equal(result.length, 3);
    assertConsecutiveOrder(result);
});

test("unknown activity/day identifiers and earlier/later boundaries leave the planner unchanged", () => {
    const original = freeze(days());
    for (const result of [
        reorderPlannerPin(original, "missing", 1),
        reorderPlannerPin(original, "A", -1),
        reorderPlannerPin(original, "C", 1),
        movePlannerPin(original, "missing", "two", "09:00"),
        movePlannerPin(original, "A", "missing", "09:00")
    ])
        assert.deepEqual(result, original);
});

function image(id: number, pinId: string, source: "upload" | "unsplash" = "upload"): BoardImageDraft {
    return {
        id: `image-${id}`,
        uploadedImageId: source === "upload" ? id : undefined,
        pinId,
        publicId: String(id),
        source,
        url: `https://images.example.test/${id}/full`,
        thumbnailUrl: `https://images.example.test/${id}/thumb`,
        width: 1200,
        height: 800,
        capturedAt: null,
        latitude: null,
        longitude: null,
        order: id,
        credit: null,
        creditUrl: null,
        sourceUrl: null
    };
}

function plannerMarkup(overrides: Partial<ComponentProps<typeof DayPlanner>> = {}) {
    return renderToStaticMarkup(
        createElement(DayPlanner, {
            days: days(),
            images: [],
            onAddDay: () => {},
            onRemoveDay: () => {},
            onAddPin: () => {},
            onUpdatePin: () => {},
            onMovePin: () => {},
            onReorderPin: () => {},
            onRemovePin: () => {},
            onAddActivityImage: () => {},
            onAssignActivityImage: () => {},
            onSetActivityCover: () => {},
            onReorderActivityImage: () => {},
            ...overrides
        })
    );
}

test("planner presents every activity and empty day without limiting long itineraries", () => {
    const itinerary = [
        { ...days()[0], pins: Array.from({ length: 8 }, (_, index) => pin(`stop-${index}`, "09:00", index)) },
        days()[2]
    ];
    const markup = plannerMarkup({ days: itinerary });
    for (const item of itinerary[0].pins) assert.ok(markup.includes(item.title), `${item.title} must be available`);
    assert.match(markup, /Day 03/);
    assert.match(markup, /Add an activity to day 3/i);
    assert.match(markup, /add day/i);
    assert.match(markup, /Click anywhere in this day to add an activity/i);
});

test("the selected uploaded activity cover is used instead of the first attached photo", () => {
    const markup = plannerMarkup({ images: [image(500, "A"), image(501, "A")] });
    assert.match(markup, /src="https:\/\/images\.example\.test\/501\/thumb"/);
    assert.doesNotMatch(markup, /src="https:\/\/images\.example\.test\/500\/thumb"/);
});

test("an explicitly external activity cover retains its Unsplash thumbnail", () => {
    const day = { ...days()[0], pins: [{ ...pin("A", "09:00", 0), coverImageId: null }] };
    const markup = plannerMarkup({ days: [day], images: [image(500, "A"), image(501, "A", "unsplash")] });
    assert.match(markup, /src="https:\/\/images\.example\.test\/501\/thumb"/);
    assert.doesNotMatch(markup, /src="https:\/\/images\.example\.test\/500\/thumb"/);
});

test("activity cards stay editable without review links or overflow menus", () => {
    const itinerary = [
        {
            ...days()[0],
            pins: [pin("A", "09:00", 0), pin("B", "10:00", 1), { ...pin("C", "11:00", 2), source: "manual" as const }]
        }
    ];
    const markup = plannerMarkup({ days: itinerary });
    assert.doesNotMatch(markup, /Review activity|aria-label="Move /i);
    assert.match(markup, /aria-label="Edit Visit A"/);
});

test("disabled planners lock editing controls and cannot expose draggable activity handles", () => {
    const markup = plannerMarkup({ disabled: true });
    assert.match(markup, /<fieldset[^>]* disabled=""/);
    assert.doesNotMatch(markup, /draggable="true"/);
});

type CategoryGroupProps = { children?: ReactNode; value?: string; onValueChange?: (value: string) => void };

function categoryGroup(node: ReactNode): CategoryGroupProps {
    const find = (child: ReactNode): CategoryGroupProps | undefined => {
        if (!isValidElement<CategoryGroupProps>(child)) return;
        if (child.props.onValueChange) return child.props;
        return Children.toArray(child.props.children).map(find).find(Boolean);
    };
    const group = find(node);
    assert.ok(group, "The production category control must expose a controlled radio group");
    return group;
}

test("category selection is controlled, reports an existing category, and rejects unknown values", () => {
    const activity = freeze(pin("A", "09:00", 0));
    const selected: string[] = [];
    const props = {
        pin: activity,
        disabled: false,
        onChange: (value: string) => {
            selected.push(value);
        }
    };
    const group = categoryGroup(ActivityCategoryPicker(props));
    assert.equal(group.value, "museum");
    group.onValueChange?.("cafe");
    group.onValueChange?.("invented-category");
    assert.deepEqual(selected, ["cafe"]);
    assert.equal(activity.category, "museum");
    assert.equal(categoryGroup(ActivityCategoryPicker(props)).value, "museum");
    assert.equal(
        categoryGroup(ActivityCategoryPicker({ ...props, pin: { ...activity, category: "cafe" } })).value,
        "cafe"
    );
    const markup = renderToStaticMarkup(createElement(ActivityCategoryPicker, props));
    assert.match(markup, /aria-label="Change category for Visit A: Museum"/);
    assert.match(markup, /aria-haspopup="menu"/);
});

test("disabled category selection cannot report changes", () => {
    const selected: string[] = [];
    const props = {
        pin: pin("A", "09:00", 0),
        disabled: true,
        onChange: (value: string) => {
            selected.push(value);
        }
    };
    categoryGroup(ActivityCategoryPicker(props)).onValueChange?.("cafe");
    assert.deepEqual(selected, []);
    const markup = renderToStaticMarkup(createElement(ActivityCategoryPicker, props));
    assert.match(markup, /<button[^>]* disabled=""/);
});
