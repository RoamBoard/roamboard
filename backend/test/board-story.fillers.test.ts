import assert from "node:assert/strict";
import test from "node:test";

import { prepareFillerPool } from "../src/features/boards/boards.fillers.js";
import type { BoardWrite } from "../src/features/boards/boards.schemas.js";
import type { FillerImage, FillerPool, FillerProvider } from "../src/features/boards/boards.types.js";

function board(): BoardWrite {
    return {
        title: "Private title must not reach providers",
        description: "Private description",
        status: "published",
        visibility: "public",
        fillerImagesEnabled: true,
        destination: {
            name: "Kyoto",
            kind: "city",
            country: "JPN",
            externalPlaceId: "geoapify:kyoto",
            latitude: 35.01,
            longitude: 135.76,
            address: null,
            city: "Kyoto"
        },
        tagIds: [],
        imageIds: [],
        days: []
    };
}

function photo(id: string): Omit<FillerImage, "position"> {
    return {
        provider: "unsplash",
        providerImageId: id,
        url: `https://images.unsplash.com/${id}?w=1600`,
        thumbnailUrl: `https://images.unsplash.com/${id}?w=320`,
        largeUrl: `https://images.unsplash.com/${id}?w=4096`,
        width: 6000,
        height: 4000,
        alt: "A destination illustration",
        photographer: "Photographer",
        photographerUrl: "https://unsplash.com/@photographer",
        sourceUrl: `https://unsplash.com/photos/${id}`
    };
}

function provider(ids = ["first", "second", "third"]) {
    const calls = { queries: [] as string[], selections: [] as string[] };
    const value: FillerProvider = {
        async search(query) {
            calls.queries.push(query);
            return ids.map((id) => ({ id }));
        },
        async select(id) {
            calls.selections.push(id);
            return photo(id);
        }
    };
    return { calls, value };
}

async function completePool(input = board()): Promise<FillerPool> {
    const result = await prepareFillerPool(input, null, provider().value);
    assert.ok(result);
    assert.equal(result.images.length, 3);
    return result;
}

test("default/off/draft preferences never perform optional provider work or replace retained records", async () => {
    const { value, calls } = provider();
    const existing = await completePool();
    for (const input of [
        { ...board(), fillerImagesEnabled: undefined },
        { ...board(), fillerImagesEnabled: false },
        { ...board(), status: "draft" as const }
    ]) {
        assert.equal(await prepareFillerPool(input, existing, value), undefined);
    }
    assert.deepEqual(calls, { queries: [], selections: [] });
});

test("complete destination selections survive ordinary edits, cosmetic destination changes and off/on toggles", async () => {
    const input = board();
    const pool = await completePool(input);
    const before = structuredClone(pool);
    const { value, calls } = provider(["replacement"]);
    assert.equal(await prepareFillerPool({ ...input, fillerImagesEnabled: false }, pool, value), undefined);
    const edited = {
        ...input,
        title: "Changed title",
        description: "Changed notes",
        destination: { ...input.destination!, name: "Kyoto City", latitude: 35.02 }
    };
    assert.deepEqual(await prepareFillerPool(edited, pool, value), before);
    assert.deepEqual(pool, before, "The saved pool must remain unchanged while preparing an update");
    assert.deepEqual(calls, { queries: [], selections: [] });
});

test("incomplete pools retry only missing selections on explicit saves and retain matching selected photos", async () => {
    const input = board();
    const full = await completePool(input);
    const existing = { ...full, images: full.images.slice(0, 1) };
    const { value, calls } = provider([existing.images[0]!.providerImageId, "new-one", "new-two", "new-two"]);
    const result = await prepareFillerPool(input, existing, value);
    assert.ok(result);
    assert.equal(result.images.length, 3);
    assert.deepEqual(result.images[0], existing.images[0]);
    assert.deepEqual(new Set(calls.selections), new Set(["new-one", "new-two"]));
    assert.deepEqual(
        result.images.map((item) => item.position),
        [0, 1, 2]
    );
    assert.deepEqual(calls.queries, ["Kyoto Japan"]);
    assert.equal(existing.images.length, 1);
});

test("destination kind, country and provider identity changes replace the old pool", async () => {
    const input = board();
    const pool = await completePool(input);
    for (const destination of [
        { ...input.destination!, kind: "region" as const },
        { ...input.destination!, country: "USA" },
        { ...input.destination!, externalPlaceId: "geoapify:another-place" }
    ]) {
        const { value, calls } = provider(["new-a", "new-b", "new-c"]);
        const result = await prepareFillerPool({ ...input, destination }, pool, value);
        assert.ok(result);
        assert.notEqual(result.destinationKey, pool.destinationKey);
        assert.deepEqual(
            new Set(result.images.map((item) => item.providerImageId)),
            new Set(["new-a", "new-b", "new-c"])
        );
        assert.equal(calls.queries.length, 1);
    }
});

test("only the first twenty relevance results are eligible and activity photos never become fillers", async () => {
    const input = board();
    input.days = [
        {
            dayNumber: 1,
            date: null,
            activities: [
                {
                    title: "Private activity title",
                    note: "Private notes",
                    position: 0,
                    activityTime: null,
                    category: "other",
                    source: "manual",
                    location: null,
                    locationConfirmed: false,
                    uploadedImageIds: [],
                    externalImage: {
                        provider: "unsplash",
                        providerImageId: "activity-photo",
                        url: "https://images.unsplash.com/activity-photo",
                        photographer: "Photographer",
                        photographerUrl: "https://unsplash.com/@photographer",
                        sourceUrl: "https://unsplash.com/photos/activity-photo"
                    }
                }
            ]
        }
    ];
    const { value, calls } = provider([
        "activity-photo",
        ...Array.from({ length: 19 }, () => "eligible"),
        "outside-first-page"
    ]);
    const result = await prepareFillerPool(input, null, value);
    assert.equal(result?.images.length, 1);
    assert.deepEqual(calls.selections, ["eligible"]);
    assert.deepEqual(calls.queries, ["Kyoto Japan"]);
});

test("provider search or canonical selection failure preserves valid partial pools without retries", async () => {
    const input = board();
    const full = await completePool(input);
    const existing = { ...full, images: full.images.slice(0, 1) };
    const calls = { searches: 0, selections: 0 };
    const failedSearch: FillerProvider = {
        async search() {
            calls.searches++;
            throw new Error("Shared provider quota unavailable");
        },
        async select() {
            throw new Error("No selection should follow a failed search");
        }
    };
    assert.deepEqual(await prepareFillerPool(input, existing, failedSearch), existing);
    const failedSelection: FillerProvider = {
        async search() {
            calls.searches++;
            return [{ id: "new-one" }, { id: "new-two" }];
        },
        async select() {
            calls.selections++;
            throw new Error("Canonical selection failed");
        }
    };
    assert.deepEqual(await prepareFillerPool(input, existing, failedSelection), existing);
    assert.deepEqual(calls, { searches: 2, selections: 1 });
    const unavailable = await prepareFillerPool(input, null, failedSearch);
    assert.deepEqual(unavailable?.images, []);
});

test("invalid canonical image dimensions are excluded instead of persisted", async () => {
    for (const dimensions of [{ width: 0 }, { width: Number.POSITIVE_INFINITY }, { height: 1.5 }]) {
        const selection = provider(["invalid"]);
        selection.value.select = async (id) => ({ ...photo(id), ...dimensions });
        const result = await prepareFillerPool(board(), null, selection.value);
        assert.deepEqual(result?.images, []);
    }
});
