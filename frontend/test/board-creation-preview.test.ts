import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import BoardCreationPreview from "../src/components/features/boards/BoardCreationPreview";
import CollageBoardCard from "../src/components/features/boards/cards/CollageBoardCard";
import { createBoardPreview } from "../src/lib/board-creation-preview";
import { photoWasEdited } from "../src/lib/use-photo-urls";
import type { BoardCreatorPayload, BoardImageDraft, BoardPinDraft } from "../src/types/board-creator";

function image(id: number, order: number, overrides: Partial<BoardImageDraft> = {}): BoardImageDraft {
    return {
        id: `image-${id}`,
        uploadedImageId: id,
        pinId: null,
        publicId: String(id),
        source: "upload",
        url: `https://api.example.test/api/v1/images/${id}/content?variant=display`,
        thumbnailUrl: `https://api.example.test/api/v1/images/${id}/content?variant=thumbnail`,
        width: 1200,
        height: 800,
        capturedAt: null,
        latitude: null,
        longitude: null,
        order,
        credit: null,
        creditUrl: null,
        sourceUrl: null,
        ...overrides
    };
}

function pin(id: string, overrides: Partial<BoardPinDraft> = {}): BoardPinDraft {
    return {
        id,
        serverActivityId: 40,
        coverImageId: null,
        order: 0,
        time: "09:00",
        title: `Visit ${id}`,
        description: `Notes for ${id}`,
        category: "museum",
        source: "manual",
        location: {
            name: "Museum",
            address: "Museum street",
            latitude: 59.32,
            longitude: 18.06,
            country: "Sweden",
            countryCode: "SWE",
            city: "Stockholm",
            mapboxId: "place-1"
        },
        ...overrides
    };
}

function board(overrides: Partial<BoardCreatorPayload> = {}): BoardCreatorPayload {
    return {
        title: "Museum trip",
        description: "A slow day among the galleries.",
        status: "draft",
        visibility: "collaborators",
        coverImageId: null,
        tags: ["Museums"],
        images: [],
        days: [{ id: "day-1", serverDayId: 2, dayNumber: 1, date: null, pins: [] }],
        ...overrides
    };
}

function freeze<T>(value: T): T {
    if (value !== null && typeof value === "object") {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}

test("preview mapping is immutable and puts the selected uploaded cover first using its protected thumbnail", () => {
    const source = freeze(board({ coverImageId: 3, images: [image(1, 2), image(2, 0), image(3, 1)] }));
    const before = structuredClone(source);
    const result = createBoardPreview(source);
    assert.equal(result.cover?.uploadedImageId, 3);
    assert.deepEqual(
        result.card.images.map((photo) => photo.src),
        [source.images[2].thumbnailUrl, source.images[1].thumbnailUrl, source.images[0].thumbnailUrl]
    );
    assert.equal(result.card.images[0].src, "https://api.example.test/api/v1/images/3/content?variant=thumbnail");
    assert.deepEqual(source, before);
});

test("collage selection removes duplicate URLs while retaining external photographs and every source image record", () => {
    const external = image(3, 1, {
        source: "unsplash",
        uploadedImageId: undefined,
        url: "https://photos.example.test/external",
        credit: "Photographer"
    });
    const duplicate = image(4, 3, { url: image(1, 0).url });
    const source = board({ coverImageId: 2, images: [duplicate, external, image(2, 2), image(1, 0)] });
    const result = createBoardPreview(source);
    assert.deepEqual(
        result.card.images.map((photo) => photo.src),
        [source.images[2].thumbnailUrl, source.images[3].thumbnailUrl, external.thumbnailUrl]
    );
    assert.equal(new Set(result.card.images.map((photo) => photo.src)).size, result.card.images.length);
    assert.equal(result.photos.length, source.images.length);
    assert.deepEqual(
        result.photos.map((photo) => photo.id),
        ["image-2", "image-1", "image-3", "image-4"]
    );
    assert.ok(result.photos.some((photo) => photo.id === duplicate.id));
    assert.ok(result.photos.some((photo) => photo.credit === "Photographer"));
});

test("only six photos enter the V1 collage, while all ten uploads remain available to the preview", () => {
    const images = Array.from({ length: 10 }, (_, index) => image(index + 1, index));
    const result = createBoardPreview(board({ coverImageId: 10, images }));
    assert.equal(result.card.images.length, 6);
    assert.deepEqual(
        result.card.images.map((photo) => photo.src),
        [images[9].thumbnailUrl, ...images.slice(0, 5).map((photo) => photo.thumbnailUrl)]
    );
    assert.equal(result.photos.length, 10);
});

test("an empty Board has no invented author, highlights, save counts, destination or images", () => {
    const result = createBoardPreview(board({ title: " ", description: "", tags: [] }));
    assert.equal(result.card.title, "Untitled Board");
    assert.equal(result.card.author, "");
    assert.deepEqual(result.card.highlights, []);
    assert.equal(result.card.savedCount, undefined);
    assert.equal(result.countryLabel, "");
    assert.equal(result.card.destinationLabel, "");
    assert.equal(result.cover, undefined);
    assert.deepEqual(result.card.images, []);
    assert.deepEqual(result.photos, []);
    assert.doesNotMatch(JSON.stringify(result), /Tokyo|Japan|traveler|Default cover/i);
});

test("generated photo locations appear in the preview without individual confirmation", () => {
    const photo = pin("photo", { source: "photo" });
    const source = board({ days: [{ id: "day-1", dayNumber: 1, date: null, pins: [photo] }] });
    const preview = createBoardPreview(source);
    assert.equal(preview.countryLabel, "SWE");
    assert.match(preview.destination, /Stockholm/);
});

test("the country watermark requires agreement across every activity location", () => {
    const swedish = pin("one");
    const sameCountry = pin("two", {
        source: "geoapify",
        location: { ...swedish.location!, countryCode: null, country: "Sweden", city: "Gothenburg" }
    });
    const make = (pins: BoardPinDraft[]) => board({ days: [{ id: "day-1", dayNumber: 1, date: null, pins }] });
    assert.equal(createBoardPreview(make([swedish, sameCountry])).countryLabel, "SWE");
    const japanese = pin("three", {
        location: { ...swedish.location!, countryCode: "JPN", country: "Japan", city: "Kyoto" }
    });
    assert.equal(createBoardPreview(make([swedish, japanese])).countryLabel, "");
    const unknown = pin("unknown", {
        location: { ...swedish.location!, countryCode: null, country: null, city: null }
    });
    assert.equal(createBoardPreview(make([swedish, unknown])).countryLabel, "");
    const unlocated = pin("unlocated", { location: null });
    assert.equal(createBoardPreview(make([swedish, unlocated])).countryLabel, "SWE");
});

test("a compact description is safely truncated while the full controlled Board remains intact", () => {
    for (const length of [116, 117, 118, 119, 120]) {
        const description = `${"A".repeat(length)}🧭 Full museum description continues here.`;
        const source = freeze(board({ description }));
        const result = createBoardPreview(source);
        assert.ok(result.card.description.length <= 120);
        assert.ok(result.card.description.length < description.length);
        assert.doesNotMatch(
            result.card.description,
            /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u
        );
        assert.equal(source.description, description);
    }
});

test("long titles keep their full metadata without leaving broken emoji in compact card lines", () => {
    for (const length of [15, 16, 17, 18]) {
        const title = `${"A".repeat(length)}🧭 very long museum itinerary title`;
        const result = createBoardPreview(board({ title }));
        assert.equal(result.card.title, title);
        for (const line of result.card.titleLines ?? [])
            assert.doesNotMatch(line, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u);
    }
});

test("dates list the actual dated days and disclose undated days without inventing a trip range", () => {
    const source = board({
        days: [
            { id: "day-1", dayNumber: 1, date: "2026-06-04", pins: [] },
            { id: "day-2", dayNumber: 2, date: null, pins: [] },
            { id: "day-3", dayNumber: 3, date: "2026-06-06", pins: [] }
        ]
    });
    assert.equal(createBoardPreview(source).dateLabel, "4 Jun 2026 · 6 Jun 2026 · 1 day undated");
    assert.equal(createBoardPreview(board()).dateLabel, "Dates open");
    assert.equal(createBoardPreview(board({ days: [] })).dateLabel, "Dates open");
    const invalid = board({ days: [{ id: "day-1", dayNumber: 1, date: "2026-02-31", pins: [] }] });
    assert.equal(createBoardPreview(invalid).dateLabel, "Dates open");
});

test("preview V1 suppresses unsupported account data while the shared card default stays unchanged", () => {
    const card = {
        id: "sample-card",
        title: "Gallery itinerary",
        author: "Actual author",
        destination: "Stockholm",
        destinationLabel: "SWE",
        images: [],
        durationDays: 2,
        description: "Museum visits",
        themes: ["Art"],
        highlights: ["A historic gallery"],
        savedCount: 153
    };
    const standard = renderToStaticMarkup(createElement(CollageBoardCard, { board: card, onBookmark: () => {} }));
    assert.match(standard, /by Actual author/);
    assert.match(standard, /Highlights:/);
    assert.match(standard, /A historic gallery/);
    assert.match(standard, /Saved by 153 travelers/);
    assert.match(standard, /aria-label="Save Gallery itinerary"/);
    const preview = renderToStaticMarkup(
        createElement(CollageBoardCard, { board: card, preview: true, onBookmark: () => {} })
    );
    assert.match(preview, /Gallery itinerary/);
    assert.doesNotMatch(
        preview,
        /by Actual author|Highlights:|A historic gallery|Saved by|aria-label="Save Gallery itinerary"/
    );
});

test("the controlled preview retains all days, more than five activities, descriptions and every photograph", () => {
    const images = Array.from({ length: 10 }, (_, index) =>
        image(index + 1, index, { pinId: index < 2 ? "stop-6" : null })
    );
    const description = `A full account that must remain available. ${"A day of galleries and walks. ".repeat(10)}`;
    const activities = Array.from({ length: 8 }, (_, index) =>
        pin(`stop-${index + 1}`, { order: index, time: index === 7 ? "" : "09:00" })
    );
    const source = board({
        description,
        images,
        coverImageId: 10,
        days: [
            { id: "day-1", dayNumber: 1, date: "2026-06-04", pins: activities },
            { id: "day-2", dayNumber: 2, date: null, pins: [] }
        ]
    });
    const markup = renderToStaticMarkup(createElement(BoardCreationPreview, { board: source }));
    for (const activity of activities) {
        assert.ok(markup.includes(activity.title), `${activity.title} must remain accessible`);
        assert.ok(markup.includes(activity.description), `${activity.description} must remain accessible`);
    }
    assert.ok(markup.includes(description.trim()));
    assert.match(markup, /Day 2/i);
    assert.match(markup, /<details/);
    for (const photo of images)
        assert.ok(markup.includes(photo.thumbnailUrl.replaceAll("&", "&amp;")), `${photo.id} must remain accessible`);
    assert.doesNotMatch(markup, /_next\/image\?url=https%3A%2F%2Fapi\.example\.test/);
});

test("saved crop revisions refresh collage, itinerary and photo-review URLs without changing Board data", () => {
    const edited = image(901, 0, { pinId: "museum" });
    const untouched = image(902, 1);
    const external = image(903, 2, {
        source: "unsplash",
        uploadedImageId: undefined,
        url: "https://images.unsplash.com/external",
        thumbnailUrl: "https://images.unsplash.com/external?w=400"
    });
    const source = freeze(
        board({
            coverImageId: 901,
            images: [
                edited,
                untouched,
                ...Array.from({ length: 4 }, (_, index) => image(904 + index, 2 + index)),
                { ...external, order: 6 }
            ],
            days: [{ id: "day-1", dayNumber: 1, date: null, pins: [pin("museum")] }]
        })
    );
    const before = structuredClone(source);
    for (const revision of [2, 3]) {
        photoWasEdited(901, revision);
        const markup = renderToStaticMarkup(createElement(BoardCreationPreview, { board: source }));
        const sources = [...markup.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((match) =>
            match[1].replaceAll("&amp;", "&")
        );
        const refreshed = `${edited.thumbnailUrl}&v=${revision}`;
        assert.ok(sources.filter((url) => url === refreshed).length >= 3);
        assert.ok(!sources.includes(edited.thumbnailUrl));
        assert.ok(sources.includes(untouched.thumbnailUrl));
        assert.ok(sources.includes(external.thumbnailUrl));
        assert.deepEqual(source, before);
    }
});

test("an empty preview stays usable without sample photos or unsupported metadata", () => {
    const markup = renderToStaticMarkup(
        createElement(BoardCreationPreview, { board: board({ title: "", description: "", tags: [] }) })
    );
    assert.match(markup, /Untitled Board/);
    assert.match(markup, /Dates open/);
    assert.doesNotMatch(markup.replace(/<[^>]*>/g, ""), /Highlights:|Saved by|by Roamboard|Tokyo|Japan/i);
    assert.doesNotMatch(markup, /<img[^>]*src="(?:\/images\/|https:\/\/images\.unsplash\.com)/);
});
