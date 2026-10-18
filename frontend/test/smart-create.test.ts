import assert from "node:assert/strict";
import test from "node:test";
import type { UploadedBoardImage } from "../src/components/features/boards/BoardImageIntake";
import { buildSmartCreatePlan } from "../src/lib/smart-create";
import type { BoardDayDraft, BoardImageDraft } from "../src/types/board-creator";

function upload(id: number, capturedAt: string | null, latitude = 48.8584): UploadedBoardImage {
    const pinId = `photo-pin-${id}`;
    return {
        image: {
            id: `photo-${id}`,
            uploadedImageId: id,
            pinId,
            publicId: String(id),
            source: "upload",
            url: `/photos/${id}`,
            thumbnailUrl: `/photos/${id}/thumbnail`,
            width: 0,
            height: 0,
            capturedAt,
            latitude,
            longitude: 2.2945,
            order: id - 1,
            credit: null,
            creditUrl: null,
            sourceUrl: null
        },
        suggestedDate: capturedAt?.slice(0, 10) ?? null,
        suggestedPin: {
            id: pinId,
            order: 0,
            time: capturedAt?.slice(11, 16) ?? "",
            title: "Eiffel Tower",
            description: "",
            category: "landmark",
            source: "photo",
            location: {
                name: "Eiffel Tower",
                address: "Champ de Mars",
                latitude,
                longitude: 2.2945,
                country: "France",
                countryCode: "FRA",
                city: "Paris",
                mapboxId: "tower"
            }
        }
    };
}

const emptyDays = (): BoardDayDraft[] => [{ id: "first-day", dayNumber: 1, date: null, pins: [] }];

test("capture dates create numbered days with empty gaps regardless of upload ordering", () => {
    const photos = [upload(1, "2026-06-23T12:45:00Z"), upload(2, "2026-06-21T08:15:00Z")];
    const before = structuredClone(photos);
    const result = buildSmartCreatePlan(emptyDays(), [], photos);
    assert.equal(result.canApply, true);
    assert.equal(result.requiresConfirmation, false);
    assert.deepEqual(
        result.days.map((day) => day.dayNumber),
        [1, 2, 3]
    );
    assert.equal(result.days[0]?.pins[0]?.time, "08:15");
    assert.equal(result.days[1]?.pins.length, 0);
    assert.equal(result.days[2]?.pins[0]?.time, "12:45");
    assert.deepEqual(photos, before);
});

test("nearby same-day photos form one activity whose cover follows upload rather than capture order", () => {
    const photos = [upload(1, "2026-06-21T11:00:00Z"), upload(2, "2026-06-21T10:00:00Z", 48.8586)];
    const result = buildSmartCreatePlan(emptyDays(), [], photos);
    const pin = result.days[0]?.pins[0];
    assert.ok(pin);
    assert.equal(result.createdCount, 1);
    assert.equal(result.days[0]?.pins.length, 1);
    assert.equal(pin.coverImageId, 1);
    assert.deepEqual(
        result.images.map((image) => image.pinId),
        [pin.id, pin.id]
    );
    assert.equal(pin.title, "Eiffel Tower");
});

test("different days, long visits and distant places do not collapse into one activity", () => {
    const result = buildSmartCreatePlan(
        emptyDays(),
        [],
        [
            upload(1, "2026-06-21T09:00:00Z"),
            upload(2, "2026-06-21T12:00:00Z"),
            upload(3, "2026-06-21T09:30:00Z", 48.87),
            upload(4, "2026-06-22T09:00:00Z")
        ]
    );
    assert.equal(result.days[0]?.pins.length, 3);
    assert.equal(result.days[1]?.pins.length, 1);
});

test("nearby photos cannot chain together places beyond the grouping radius", () => {
    const result = buildSmartCreatePlan(
        emptyDays(),
        [],
        [
            upload(1, "2026-06-21T09:00:00Z"),
            upload(2, "2026-06-21T09:10:00Z", 48.8591),
            upload(3, "2026-06-21T09:20:00Z", 48.8598)
        ]
    );
    assert.equal(result.days[0]?.pins.length, 2);
    assert.equal(result.images.filter((image) => image.pinId === result.images[0]?.pinId).length, 2);
});

test("the earliest capture anchors a 31-day window and excluded late photos remain unattached", () => {
    const result = buildSmartCreatePlan(
        emptyDays(),
        [],
        [upload(1, "2026-08-01T09:00:00Z"), upload(2, "2026-06-01T09:00:00Z"), upload(3, "2026-07-01T09:00:00Z")]
    );
    assert.equal(result.days.length, 31);
    assert.equal(result.days[0]?.pins.length, 1);
    assert.equal(result.days[30]?.pins.length, 1);
    assert.equal(result.ignoredCount, 1);
    assert.equal(result.images.find((image) => image.uploadedImageId === 1)?.pinId, null);
});

test("missing GPS leaves the photo unattached and missing time stays empty", () => {
    const noGps = upload(1, "2026-06-21T09:00:00Z");
    noGps.image.latitude = null;
    noGps.image.longitude = null;
    noGps.image.pinId = null;
    noGps.suggestedPin = null;
    const result = buildSmartCreatePlan(emptyDays(), [], [noGps, upload(2, null)]);
    assert.equal(result.images.find((image) => image.uploadedImageId === 1)?.pinId, null);
    assert.equal(result.days.flatMap((day) => day.pins).length, 1);
    assert.equal(result.days.flatMap((day) => day.pins)[0]?.time, "");
});

test("an earlier batch proposes a shift without mutating existing days or edited activities", () => {
    const initial = buildSmartCreatePlan(emptyDays(), [], [upload(1, "2026-06-23T09:00:00Z")]);
    const existing = initial.days[0]?.pins[0];
    assert.ok(existing);
    Object.assign(existing, { title: "Our picnic", time: "15:45", category: "restaurant", coverImageId: 99 });
    const daysBefore = structuredClone(initial.days);
    const imagesBefore = structuredClone(initial.images);
    const revised = buildSmartCreatePlan(initial.days, initial.images, [upload(2, "2026-06-21T10:00:00Z")]);
    assert.equal(revised.requiresConfirmation, true);
    assert.equal(revised.shiftDays, 2);
    assert.deepEqual(revised.days.find((day) => day.dayNumber === 3)?.pins[0], existing);
    assert.deepEqual(initial.days, daysBefore);
    assert.deepEqual(initial.images, imagesBefore);
});

test("adding another nearby batch preserves manual edits and the chosen activity cover", () => {
    const first = buildSmartCreatePlan(emptyDays(), [], [upload(1, "2026-06-21T09:00:00Z")]);
    const edited = first.days[0]?.pins[0];
    assert.ok(edited?.location);
    Object.assign(edited, {
        title: "Breakfast with friends",
        time: "10:30",
        category: "cafe",
        description: "My notes",
        coverImageId: 99
    });
    edited.location = { ...edited.location, name: "My chosen place" };
    const before = structuredClone(edited);
    const result = buildSmartCreatePlan(first.days, first.images, [upload(2, "2026-06-21T09:30:00Z")]);
    assert.deepEqual(result.days[0]?.pins[0], before);
    assert.equal(result.days[0]?.pins.length, 1);
    assert.equal(result.images.find((image) => image.uploadedImageId === 2)?.pinId, edited.id);
});

test("repeated batches can exceed thirty total photos without discarding earlier uploads", () => {
    const photos = Array.from({ length: 30 }, (_, index) => upload(index + 1, "2026-06-21T09:00:00Z"));
    const first = buildSmartCreatePlan(emptyDays(), [], photos);
    const result = buildSmartCreatePlan(first.days, first.images, [upload(31, "2026-06-21T09:30:00Z")]);
    assert.equal(result.images.length, 31);
    assert.ok(result.images.every((image: BoardImageDraft) => image.pinId !== null));
    assert.equal(result.days[0]?.pins.length, 1);
});

test("rebasing an earlier batch lists activities outside Day 31 and keeps their images unassigned", () => {
    const initial = buildSmartCreatePlan(
        emptyDays(),
        [],
        [upload(1, "2026-06-21T09:00:00Z"), upload(2, "2026-07-21T09:00:00Z")]
    );
    const excluded = initial.days[30]?.pins[0];
    assert.ok(excluded);
    excluded.title = "My last-day visit";
    const before = structuredClone(initial);
    const result = buildSmartCreatePlan(initial.days, initial.images, [upload(3, "2026-06-20T09:00:00Z")]);
    assert.equal(result.requiresConfirmation, true);
    assert.equal(result.canApply, true);
    assert.equal(result.shiftDays, 1);
    assert.deepEqual(result.removedTitles, ["My last-day visit"]);
    assert.equal(result.images.find((image) => image.uploadedImageId === 2)?.pinId, null);
    assert.equal(result.days.find((day) => day.dayNumber === 2)?.pins[0]?.coverImageId, 1);
    assert.ok(result.days.every((day) => day.dayNumber <= 31));
    assert.deepEqual(initial, before);
});

test("rebasing cannot silently delete a manual activity beyond Day 31", () => {
    const initial = buildSmartCreatePlan(emptyDays(), [], [upload(1, "2026-06-21T09:00:00Z")]);
    const manual = structuredClone(initial.days[0]!.pins[0]!);
    manual.id = "manual-last-day";
    manual.source = "manual";
    manual.title = "Keep this booking";
    initial.days.push({ id: "last-day", dayNumber: 31, date: null, pins: [manual] });
    const before = structuredClone(initial);
    const result = buildSmartCreatePlan(initial.days, initial.images, [upload(2, "2026-06-20T09:00:00Z")]);
    assert.equal(result.canApply, false);
    assert.ok(result.warnings.length);
    assert.deepEqual(initial, before);
});

test("the session start date remains stable when an existing photo activity is moved to another day", () => {
    const initial = buildSmartCreatePlan(emptyDays(), [], [upload(1, "2026-06-21T09:00:00Z")], null);
    const moved = initial.days[0]!.pins[0]!;
    const days: BoardDayDraft[] = [
        { id: "day-one", dayNumber: 1, date: null, pins: [] },
        { id: "day-two", dayNumber: 2, date: null, pins: [] },
        { id: "day-three", dayNumber: 3, date: null, pins: [moved] }
    ];
    const result = buildSmartCreatePlan(days, initial.images, [upload(2, "2026-06-23T12:00:00Z")], "2026-06-21");
    assert.equal(result.requiresConfirmation, false);
    assert.equal(result.shiftDays, 0);
    assert.equal(result.days[0]?.pins.length, 0);
    assert.equal(result.days[2]?.pins.length, 2);
    assert.equal(result.days[2]?.pins[0]?.id, moved.id);
    assert.equal(result.images.find((image) => image.uploadedImageId === 2)?.pinId, result.days[2]?.pins[1]?.id);
});
