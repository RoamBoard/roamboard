import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PublishedBoardDay from "../src/components/features/boards/PublishedBoardDay";
import {
    createBoardPhotoSource,
    getBoardPhotoSlots,
    resolveBoardPhotos,
    type PhotoSlot
} from "../src/lib/board-photos";
import type { ProviderPhoto } from "../src/lib/providers";
import type { Board, BoardActivity, BoardImage } from "../src/types/board";

function photo(id: string, changes: Partial<ProviderPhoto> = {}): ProviderPhoto {
    return {
        id,
        url: `https://images.unsplash.com/photo-${id}?w=1600`,
        thumbnailUrl: `https://images.unsplash.com/photo-${id}?w=400`,
        alt: `Station ${id}`,
        photographer: "Ada Rail",
        photographerUrl: "https://unsplash.com/@adarail",
        sourceUrl: `https://unsplash.com/photos/${id}`,
        width: 1600,
        height: 1000,
        ...changes
    };
}

function activity(id: string, dayNumber = 1, city = "Tokyo"): BoardActivity {
    return {
        id,
        type: "activity",
        title: `Stored activity ${id}`,
        description: "Saved activity notes",
        dayNumber,
        images: [],
        location: {
            id: `location-${id}`,
            source: "manual",
            name: `${city} Central Station`,
            city,
            countryCode: "JPN",
            latitude: 35.68,
            longitude: 139.76
        }
    };
}

function board(): Board {
    return {
        id: "718",
        ownerId: "station_walker",
        title: "A title that must never become a search query",
        description: "Private trip notes are not photo search terms.",
        visibility: "public",
        isCompleted: false,
        tags: [],
        destinations: [{ country: "Japan", countryCode: "JPN", cities: ["Tokyo", "Kyoto"] }],
        durationDays: 3,
        dayNumbers: [1, 2, 5],
        items: [activity("a"), activity("b"), activity("c"), activity("d"), activity("e", 2, "Kyoto")],
        createdAt: "2026-10-10T08:00:00Z",
        updatedAt: "2026-10-11T08:00:00Z"
    };
}

function slot(id: string, query = "Tokyo Japan", backupQuery: string | null = null): PhotoSlot {
    return { id, dayNumber: 1, label: "Tokyo, Japan", query, backupQuery, enabled: true };
}

function replaceFetch(t: TestContext, replacement: typeof fetch) {
    const original = globalThis.fetch;
    globalThis.fetch = replacement;
    t.after(() => {
        globalThis.fetch = original;
    });
}

test("a day with one saved activity photo retains that photo beside its location placeholder or credited automatic photo", () => {
    const entry = activity("single");
    entry.images = [{ id: "my-photo", url: "/my-station-photo.jpg", alt: "My station photo", source: "upload" }];
    const day = { number: 1, title: "Tokyo stations", items: [entry] };
    const placeholder = renderToStaticMarkup(
        createElement(PublishedBoardDay, {
            day,
            onSelectActivity() {},
            photoLabels: { first: "Tokyo, Japan" }
        })
    );
    assert.match(placeholder, /Tokyo, Japan/);
    assert.match(placeholder, /src="\/my-station-photo\.jpg"/);
    const automatic: BoardImage = {
        id: "automatic-photo",
        url: "https://images.unsplash.com/photo-automatic?w=1600",
        alt: "Tokyo railway station",
        source: "application",
        photographer: "Ada Rail",
        photographerUrl: "https://unsplash.com/@adarail",
        sourceUrl: "https://unsplash.com/photos/automatic"
    };
    const filled = renderToStaticMarkup(
        createElement(PublishedBoardDay, {
            day,
            onSelectActivity() {},
            photos: { first: automatic },
            photoLabels: { first: "Tokyo, Japan" }
        })
    );
    assert.match(filled, /src="\/my-station-photo\.jpg"/);
    assert.match(filled, /src="https:\/\/images\.unsplash\.com\/photo-automatic\?w=1600"/);
    assert.match(filled, /Ada Rail/);
    assert.match(filled, /href="https:\/\/unsplash\.com\/@adarail/);
});

test("photo slots use real city and country while retaining decorative slots alongside activity photos", () => {
    const source = board();
    const first = source.items[0];
    assert.ok(first?.type === "activity");
    first.images = [{ id: "manual-1", url: "/saved-photo.jpg", alt: "Saved photo", source: "upload" }];
    const slots = getBoardPhotoSlots(source, ["Architecture"]);
    assert.deepEqual(
        slots.map((entry) => entry.id),
        ["cover", "day-1-first", "day-1-second", "day-2-first"]
    );
    assert.equal(slots.find((entry) => entry.id === "cover")?.enabled, true);
    for (const entry of slots.filter((entry) => entry.dayNumber === 1)) {
        assert.match(entry.query ?? "", /Tokyo/i);
        assert.match(entry.query ?? "", /Japan/i);
        assert.doesNotMatch(entry.query ?? "", /Stored activity|title that must|Private trip notes/i);
    }
    assert.ok(slots.every((entry) => entry.dayNumber !== 5));
    const secondDay = slots.find((entry) => entry.id === "day-2-first");
    assert.match(secondDay?.query ?? "", /Kyoto/i);
    assert.match(secondDay?.query ?? "", /Japan/i);
});

test("a chosen header is never requested or replaced", async () => {
    const source = board();
    source.items = [];
    source.coverImage = { id: "chosen-header", url: "/chosen-header.jpg", alt: "My selected header", source: "upload" };
    const before = structuredClone(source);
    const slots = getBoardPhotoSlots(source);
    assert.equal(slots.find((entry) => entry.id === "cover")?.enabled, false);
    const queries: string[] = [];
    const images = await resolveBoardPhotos(source, slots, async (query) => {
        queries.push(query);
        return [photo("unused")];
    });
    assert.deepEqual(images, {});
    assert.deepEqual(queries, []);
    assert.deepEqual(source, before);
});

test("one city search supplies different photos across slots and excludes existing activity and cover photos", async () => {
    const source = board();
    const first = source.items[0];
    assert.ok(first?.type === "activity");
    first.images = [
        {
            id: "unsplash-existing",
            url: "https://images.unsplash.com/photo-existing?w=400",
            alt: "Saved activity image",
            source: "application"
        }
    ];
    source.coverImage = {
        id: "chosen",
        url: "https://images.unsplash.com/photo-cover?w=700",
        alt: "Selected header",
        source: "application"
    };
    const before = structuredClone(source);
    const queries: string[] = [];
    const images = await resolveBoardPhotos(
        source,
        [slot("day-1-first"), slot("day-1-second"), slot("day-2-first")],
        async (query) => {
            queries.push(query);
            return [photo("existing"), photo("cover"), photo("first"), photo("first"), photo("second"), photo("third")];
        }
    );
    assert.deepEqual(queries, ["Tokyo Japan"]);
    assert.deepEqual(
        [images["day-1-first"]?.url, images["day-1-second"]?.url, images["day-2-first"]?.url],
        [
            "https://images.unsplash.com/photo-first?w=1600",
            "https://images.unsplash.com/photo-second?w=1600",
            "https://images.unsplash.com/photo-third?w=1600"
        ]
    );
    assert.equal(images["day-1-first"]?.photographer, "Ada Rail");
    assert.equal(images["day-1-first"]?.photographerUrl, "https://unsplash.com/@adarail");
    assert.equal(images["day-1-first"]?.sourceUrl, "https://unsplash.com/photos/first");
    assert.deepEqual(source, before);
});

test("only unresolved slots request their broader location and tag backup", async () => {
    const queries: string[] = [];
    const images = await resolveBoardPhotos(
        board(),
        [
            slot("first", "Tokyo Japan", "Japan Architecture"),
            slot("second", "Tokyo Japan", "Japan Architecture"),
            slot("third", "Tokyo Japan", "Japan Architecture")
        ],
        async (query) => {
            queries.push(query);
            return query === "Tokyo Japan" ? [photo("primary")] : [photo("primary"), photo("backup"), photo("another")];
        }
    );
    assert.deepEqual(queries, ["Tokyo Japan", "Japan Architecture"]);
    assert.equal(images.first?.url, "https://images.unsplash.com/photo-primary?w=1600");
    assert.equal(images.second?.url, "https://images.unsplash.com/photo-backup?w=1600");
    assert.equal(images.third?.url, "https://images.unsplash.com/photo-another?w=1600");
});

test("location without a city searches its saved place and country, with a broader location/tag backup", () => {
    const source = board();
    const entry = activity("shrine");
    assert.ok(entry.location);
    delete entry.location.city;
    entry.location.name = "Fushimi Inari";
    source.items = [entry];
    const slots = getBoardPhotoSlots(source, ["Architecture"]);
    const day = slots.find((entry) => entry.id === "day-1-first");
    assert.match(day?.query ?? "", /Fushimi Inari/i);
    assert.match(day?.query ?? "", /Japan/i);
    assert.match(day?.backupQuery ?? "", /Japan/i);
    assert.match(day?.backupQuery ?? "", /Architecture/i);
});

test("individual provider failures and unusable results leave slots empty while other locations resolve", async () => {
    const images = await resolveBoardPhotos(
        board(),
        [
            slot("failed", "Osaka Japan"),
            slot("empty", "Nara Japan"),
            slot("no-results", "Yokohama Japan"),
            slot("usable", "Kyoto Japan")
        ],
        async (query) => {
            if (query === "Osaka Japan") throw new Error("Provider unavailable");
            if (query === "Yokohama Japan") return [];
            if (query === "Nara Japan")
                return [photo("blank", { url: "" }), photo("invalid", { url: "not an image URL" })];
            return [photo("kyoto")];
        }
    );
    assert.deepEqual(Object.keys(images), ["usable"]);
    assert.equal(images.usable?.url, "https://images.unsplash.com/photo-kyoto?w=1600");
});

test("a failed primary provider request leaves its placeholder without automatically requesting a backup", async () => {
    const queries: string[] = [];
    const images = await resolveBoardPhotos(
        board(),
        [slot("first", "Tokyo Japan", "Japan Architecture"), slot("second", "Tokyo Japan", "Japan Architecture")],
        async (query) => {
            queries.push(query);
            if (query === "Tokyo Japan") throw new Error("Provider unavailable");
            return [photo("unexpected-retry")];
        }
    );
    assert.deepEqual(queries, ["Tokyo Japan"]);
    assert.deepEqual(images, {});
});

test("Boards without location data use tags when present and never invent a title-based photo query", async () => {
    const source = board();
    source.destinations = [];
    const entry = activity("unlocated");
    delete entry.location;
    source.items = [entry];
    const withTags = getBoardPhotoSlots(source, ["Architecture"]);
    assert.ok(withTags.every((entry) => /Architecture/i.test(`${entry.query ?? ""} ${entry.backupQuery ?? ""}`)));
    const withoutTags = getBoardPhotoSlots(source);
    assert.ok(withoutTags.every((entry) => entry.query === null && entry.backupQuery === null));
    const queries: string[] = [];
    const images = await resolveBoardPhotos(source, withoutTags, async (query) => {
        queries.push(query);
        return [photo("unexpected")];
    });
    assert.deepEqual(queries, []);
    assert.deepEqual(images, {});
});

test("cached photo searches coalesce normalized in-flight queries and retain successful results for one hour", async () => {
    const clock = { now: 0 };
    const queries: string[] = [];
    const pending: { resolve?: (photos: ProviderPhoto[]) => void } = {};
    const source = createBoardPhotoSource(
        (query) => {
            queries.push(query);
            return new Promise<ProviderPhoto[]>((resolve) => {
                pending.resolve = resolve;
            });
        },
        () => clock.now
    );
    const first = source("  Tokyo   Japan  ");
    const overlapping = source("tokyo japan");
    assert.equal(queries.length, 1);
    pending.resolve!([photo("cached")]);
    assert.deepEqual(await first, [photo("cached")]);
    assert.deepEqual(await overlapping, [photo("cached")]);
    clock.now = 3_599_999;
    assert.deepEqual(await source("TOKYO JAPAN"), [photo("cached")]);
    assert.equal(queries.length, 1);
    clock.now = 3_600_001;
    const expired = source("Tokyo Japan");
    assert.equal(queries.length, 2);
    pending.resolve!([photo("refreshed")]);
    assert.deepEqual(await expired, [photo("refreshed")]);
});

test("empty results cache for five minutes and failed searches for thirty seconds", async () => {
    const clock = { now: 0 };
    const calls = { empty: 0, failed: 0 };
    const source = createBoardPhotoSource(
        async (query) => {
            if (query === "empty") {
                calls.empty += 1;
                return [];
            }
            calls.failed += 1;
            throw new Error("Provider rejected request");
        },
        () => clock.now
    );
    assert.deepEqual(await source("empty"), []);
    await assert.rejects(source("failed"), /Provider rejected request/);
    clock.now = 29_999;
    await assert.rejects(source("failed"), /Provider rejected request/);
    assert.equal(calls.failed, 1);
    clock.now = 30_001;
    await assert.rejects(source("failed"), /Provider rejected request/);
    assert.equal(calls.failed, 2);
    clock.now = 299_999;
    assert.deepEqual(await source("empty"), []);
    assert.equal(calls.empty, 1);
    clock.now = 300_001;
    assert.deepEqual(await source("empty"), []);
    assert.equal(calls.empty, 2);
});

test("the photo cache evicts old entries instead of retaining more than sixty-four searches", async () => {
    const queries: string[] = [];
    const source = createBoardPhotoSource(
        async (query) => {
            queries.push(query);
            return [photo(query)];
        },
        () => 0
    );
    for (const index of Array.from({ length: 65 }, (_, index) => index)) await source(`place ${index}`);
    await source("place 0");
    assert.equal(queries.filter((query) => query === "place 0").length, 2);
    await source("place 64");
    assert.equal(queries.filter((query) => query === "place 64").length, 1);
});

test("the default source requests the credentialed backend with enough distinct photo candidates", async (t) => {
    const calls: Array<{ url: URL; init?: RequestInit }> = [];
    replaceFetch(t, async (input, init) => {
        calls.push({ url: new URL(String(input)), init });
        return Response.json({ data: [photo("backend")] });
    });
    const result = await createBoardPhotoSource()("Tokyo Japan");
    assert.equal(result[0]?.id, "backend");
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url.origin, new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").origin);
    assert.equal(calls[0]?.url.pathname, "/api/v1/providers/unsplash/search");
    assert.match(calls[0]?.url.searchParams.get("q") ?? "", /Tokyo Japan/i);
    assert.equal(calls[0]?.url.searchParams.get("limit"), "10");
    assert.equal(calls[0]?.init?.credentials, "include");
});
