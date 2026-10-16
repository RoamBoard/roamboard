import assert from "node:assert/strict";
import test from "node:test";
import { getBoardDays } from "../src/lib/board-presentation";
import { addActivityToPreviewCopy } from "../src/lib/board-preview";
import type { Board, BoardActivity } from "../src/types/board";

function activity(): BoardActivity {
    return {
        id: "activity-55",
        type: "activity",
        title: "Station visit",
        description: "An undated activity from day five.",
        dayNumber: 5,
        images: []
    };
}

function board(): Board {
    return {
        id: "board-18",
        ownerId: "station_walker",
        title: "Station visits",
        description: "One activity and two empty days.",
        visibility: "public",
        isCompleted: true,
        tags: [],
        destinations: [],
        durationDays: 3,
        dayNumbers: [1, 2, 5],
        dayTitles: { 2: "Rest day" },
        items: [activity()],
        createdAt: "2026-10-10T08:00:00Z",
        updatedAt: "2026-10-11T08:00:00Z"
    };
}

test("a new single-activity preview copy has only day one instead of inheriting empty source days", () => {
    const source = board();
    const before = structuredClone(source);
    const copy = addActivityToPreviewCopy(source, activity(), null);
    assert.equal(copy.durationDays, 1);
    assert.deepEqual(
        getBoardDays(copy).map((day) => ({ number: day.number, count: day.items.length })),
        [{ number: 1, count: 1 }]
    );
    assert.equal(copy.items[0]?.dayNumber, 1);
    assert.deepEqual(source, before);
});

test("adding an activity to an existing preview copy keeps its empty days and includes the activity's day", () => {
    const existing: Board = {
        ...board(),
        id: "preview-existing",
        ownerId: "preview-owner",
        title: "My tab-local copy",
        description: "Existing copy notes",
        visibility: "private",
        isCompleted: false,
        durationDays: 3,
        dayNumbers: [1, 3],
        dayTitles: { 3: "Rest day" },
        items: []
    };
    const before = structuredClone(existing);
    const copy = addActivityToPreviewCopy(board(), activity(), existing);
    assert.equal(copy.id, "preview-existing");
    assert.equal(copy.title, "My tab-local copy");
    assert.equal(copy.description, "Existing copy notes");
    assert.deepEqual(
        getBoardDays(copy).map((day) => ({ number: day.number, count: day.items.length })),
        [
            { number: 1, count: 0 },
            { number: 3, count: 0 },
            { number: 5, count: 1 }
        ]
    );
    assert.equal(getBoardDays(copy)[1]?.title, "Rest day");
    assert.deepEqual(existing, before);
});
