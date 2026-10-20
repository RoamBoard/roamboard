import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BoardCreationPreview from "../src/components/features/boards/BoardCreationPreview";
import BoardPreviewSection from "../src/components/features/boards/BoardPreviewSection";
import { createBoardPreview } from "../src/lib/board-creation-preview";
import type { BoardCreatorPayload, BoardImageDraft, BoardPinDraft } from "../src/types/board-creator";

function photo(id: number, overrides: Partial<BoardImageDraft> = {}): BoardImageDraft {
    return {
        id: `creator-image-${id}`,
        uploadedImageId: id,
        publicId: String(id),
        source: "upload",
        pinId: null,
        url: `https://api.example.test/api/v1/images/${id}/content?variant=display`,
        thumbnailUrl: `https://api.example.test/api/v1/images/${id}/content?variant=thumbnail`,
        width: 1400,
        height: 1000,
        capturedAt: null,
        latitude: null,
        longitude: null,
        order: id,
        credit: null,
        creditUrl: null,
        sourceUrl: null,
        ...overrides
    };
}

function activity(id: string, overrides: Partial<BoardPinDraft> = {}): BoardPinDraft {
    return {
        id,
        order: 0,
        time: "10:30",
        title: `Visit ${id}`,
        description: `Complete notes for ${id}`,
        category: "neighborhood",
        source: "manual",
        location: {
            name: "The waterfront",
            address: "A real saved address",
            city: "Oslo",
            country: "Norway",
            countryCode: "NOR",
            latitude: 59.91,
            longitude: 10.75,
            mapboxId: null
        },
        ...overrides
    };
}

function board(overrides: Partial<BoardCreatorPayload> = {}): BoardCreatorPayload {
    return {
        title: "An afternoon along the waterfront",
        description: "Our real route and notes.",
        status: "draft",
        visibility: "friends",
        tags: ["Architecture", "Museums"],
        coverImageId: 23,
        images: [photo(22), photo(23)],
        days: [{ id: "creator-day", dayNumber: 1, date: null, pins: [activity("waterfront")] }],
        ...overrides
    };
}

function pairedCards(markup: string) {
    const cards = [...markup.matchAll(/<article\b[^>]*style="aspect-ratio:400 \/ 500"[^>]*>[\s\S]*?<\/article>/g)];
    assert.equal(cards.length, 2, "The creator diagram must compare two shared V4 cards of the same Board");
    assert.match(markup, /COVER VIEW/);
    assert.match(markup, /DETAILS VIEW/);
    return cards.map((match) => match[0]);
}

test("the creator's V4 adapter preserves real author and metadata, selected cover delivery and immutable editor state", () => {
    const source = board();
    const original = structuredClone(source);
    const preview = createBoardPreview(source, "the_complete_author_handle");
    assert.equal(preview.photo.title, source.title);
    assert.equal(preview.photo.author, "the_complete_author_handle");
    assert.equal(preview.photo.destination, "Oslo · Norway");
    assert.equal(preview.photo.destinationLabel, "NOR");
    assert.deepEqual(preview.photo.tags, ["Architecture", "Museums"]);
    assert.equal(preview.photo.description, source.description);
    assert.equal(preview.photo.durationDays, 1);
    assert.equal(preview.photo.status, "draft");
    assert.equal(preview.photo.visibility, "friends");
    assert.equal(preview.photo.savedCount, undefined);
    assert.equal(preview.photo.image?.src, source.images[1].url);
    assert.equal(preview.cover?.uploadedImageId, 23);
    assert.deepEqual(source, original);
});

test("an unselected cover falls back to an existing photo in editor order while preserving external credits", () => {
    const external = photo(30, {
        source: "unsplash",
        uploadedImageId: undefined,
        order: 0,
        url: "https://images.unsplash.com/photo-real-provider-reference",
        thumbnailUrl: "https://images.unsplash.com/photo-real-provider-reference?w=400",
        credit: "The Source Photographer",
        creditUrl: "https://unsplash.com/@sourcephotographer",
        sourceUrl: "https://unsplash.com/photos/real-provider-reference"
    });
    const source = board({ coverImageId: 999, images: [photo(31), external] });
    const preview = createBoardPreview(source);
    assert.equal(preview.cover, undefined, "A fallback photo must not pretend to be a selected upload cover");
    assert.equal(preview.photo.image?.src, external.url);
    assert.equal(preview.photo.image?.credit, external.credit);
    assert.equal(preview.photo.image?.creditUrl, external.creditUrl);
    assert.equal(preview.photo.image?.sourceUrl, external.sourceUrl);
    assert.equal(preview.photos.length, 2);
    const markup = renderToStaticMarkup(
        createElement(BoardCreationPreview, {
            board: board({ coverImageId: null, images: [photo(31)] })
        })
    );
    const annotations = [...markup.matchAll(/<dl\b[^>]*>([\s\S]*?)<\/dl>/g)].map((match) => match[1]).join(" ");
    assert.doesNotMatch(annotations.replace(/<[^>]*>/g, " "), /selected photograph|selected cover/i);
});

test("V4 creator destinations include generated photo places immediately and never infer a destination from the title", () => {
    const candidate = activity("photo-location", { source: "photo" });
    const source = board({
        title: "Postcards from Imaginary City",
        days: [{ id: "day", dayNumber: 1, date: null, pins: [candidate] }]
    });
    const generated = createBoardPreview(source);
    assert.equal(generated.photo.destination, "Oslo · Norway");
    assert.equal(generated.photo.destinationLabel, "NOR");
    const unlocated = createBoardPreview({
        ...source,
        days: [{ id: "day", dayNumber: 1, date: null, pins: [{ ...candidate, location: null }] }]
    });
    assert.equal(unlocated.photo.destination, "");
    assert.equal(unlocated.photo.destinationLabel, "");
    const otherCountry = activity("other-country", {
        location: { ...candidate.location!, city: "Paris", country: "France", countryCode: "FRA" }
    });
    const multipleCountries = createBoardPreview(
        board({ days: [{ id: "day", dayNumber: 1, date: null, pins: [activity("one"), otherCountry] }] })
    );
    assert.equal(
        multipleCountries.photo.destinationLabel,
        "",
        "Country lettering requires agreement between real locations"
    );
});

test("an empty creator preview stays V4 without fictional photography, authors, destinations or account controls", () => {
    const source = board({ title: "", description: "", tags: [], images: [], coverImageId: null, days: [] });
    const preview = createBoardPreview(source);
    assert.equal(preview.photo.title, "Untitled Board");
    assert.equal(preview.photo.author, "");
    assert.equal(preview.photo.destination, "");
    assert.equal(preview.photo.destinationLabel, "");
    assert.equal(preview.photo.image, undefined);
    assert.equal(preview.photo.savedCount, undefined);
    const markup = renderToStaticMarkup(createElement(BoardCreationPreview, { board: source }));
    for (const card of pairedCards(markup)) {
        assert.match(card, /Untitled Board/);
        assert.match(card, /No cover photo/);
        assert.doesNotMatch(
            card,
            /<img\b|<button\b|aria-pressed=|aria-label="(?:Public|Friends|Restricted access|Save|Unsave)/
        );
        assert.doesNotMatch(card, /Destination not added|by you|Roamboard|Tokyo|Japan/);
    }
    assert.equal((markup.match(/data-photo-board-expanded="true"/g) ?? []).length, 1);
    assert.equal((markup.match(/data-photo-board-expanded="false"/g) ?? []).length, 1);
    assert.doesNotMatch(markup, />Destination<|>Tags<|>Duration<|Dates open/);
});

test("the populated creator uses shared V4 without save or owner-visibility controls and retains real source-edit targets", () => {
    const markup = renderToStaticMarkup(
        createElement(BoardCreationPreview, { board: board(), author: "actual_author" })
    );
    const cards = pairedCards(markup);
    for (const card of cards) {
        assert.match(card, /by actual_author/);
        assert.match(card, /\/images\/23\/content\?variant=display/);
        assert.doesNotMatch(
            card,
            /<button\b|aria-pressed=|aria-label="(?:Public|Friends|Restricted access|Save|Unsave)/
        );
    }
    assert.equal((markup.match(/data-photo-board-expanded="true"/g) ?? []).length, 1);
    assert.equal((markup.match(/data-photo-board-expanded="false"/g) ?? []).length, 1);
    assert.match(cards[1], /aria-label="Board details" aria-hidden="false"/);
    assert.match(cards[1], /Oslo · Norway/);
    assert.match(cards[1], /Architecture/);
    assert.match(cards[1], /Museums/);
    assert.match(cards[1], /1 day/);
    const targets = [...markup.matchAll(/href="#([^"#]+)"/g)].map((match) => match[1]);
    for (const target of ["board-title", "board-images", "details-discovery", "day-plan"])
        assert.ok(targets.includes(target), `The existing editor target #${target} must remain reachable`);
    assert.doesNotMatch(markup, /href="#(?:undefined|null)"|[\d,]+ saves|>(?:Details|Close)(?:<|$)/);
});

test("outer annotations describe only visible card fields and keep duration read-only", () => {
    const markup = renderToStaticMarkup(
        createElement(BoardCreationPreview, {
            board: board({ status: "published", visibility: "collaborators" }),
            author: "original_author"
        })
    );
    assert.match(markup, /aria-label="Edit title"/);
    assert.match(markup, /aria-label="Manage photos"/);
    assert.match(markup, /href="#details-discovery"/);
    assert.match(markup, />Destination</);
    assert.match(markup, />Tags</);
    assert.match(markup, />Duration</);
    assert.doesNotMatch(markup, />(?:Description|Visibility|Dates|Dates &amp; duration)</);
    assert.doesNotMatch(markup, /aria-label="(?:Edit visibility|Edit description|Review dates|Edit duration)/);
    assert.doesNotMatch(markup, /href="#board-basics"/);
    const annotations = [...markup.matchAll(/<dl\b[^>]*>([\s\S]*?)<\/dl>/g)].map((match) => match[1]);
    assert.equal(annotations.length, 2);
    const text = annotations.join(" ").replace(/<[^>]*>/g, " ");
    for (const value of [
        "An afternoon along the waterfront",
        "Our real route and notes.",
        "Oslo",
        "Architecture",
        "Museums"
    ])
        assert.ok(!text.includes(value), "Explanatory annotations must not duplicate the Board's value lists");
    const headings = [...annotations.join(" ").matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>/g)].map((match) => match[1]);
    for (const label of ["Edit title", "Manage photos", "Edit places in the day plan", "Edit details"])
        assert.ok(
            headings.some((heading) => heading.includes(`aria-label="${label}"`)),
            `${label} belongs directly to its annotation heading`
        );
    const duration = headings.find((heading) => heading.includes("Duration"));
    assert.ok(duration);
    assert.doesNotMatch(
        duration,
        /<a\b|<button\b|<svg\b|aria-hidden="true"/,
        "Duration must not imply a date-editing action"
    );
});

test("creator comparison leaves visibility editing and access explanations in the actual editor", () => {
    for (const visibility of ["public", "friends", "collaborators"] as const) {
        for (const status of ["draft", "published"] as const) {
            const markup = renderToStaticMarkup(
                createElement(BoardCreationPreview, { board: board({ status, visibility }) })
            );
            for (const card of pairedCards(markup)) {
                assert.doesNotMatch(card, /aria-label="(?:Public|Friends|Restricted access) —/);
                if (status === "draft") {
                    assert.match(card, /aria-label="Draft —/);
                    assert.match(card, /lucide-file-pen-line/);
                } else assert.doesNotMatch(card, /aria-label="Draft —/);
            }
            assert.doesNotMatch(
                markup,
                /aria-label="Edit visibility"|>Visibility<|when published|Drafts are visible only to you/
            );
        }
    }
});

test("a read-only preview retains the complete itinerary and original photo credits while removing editor links", () => {
    const images = Array.from({ length: 9 }, (_, index) => photo(index + 1));
    images[0] = photo(1, {
        source: "unsplash",
        uploadedImageId: undefined,
        url: "https://photos.example.test/external-full.jpg",
        thumbnailUrl: "https://photos.example.test/external-thumb.jpg",
        credit: "Original Photographer",
        creditUrl: "https://photos.example.test/photographer",
        sourceUrl: "https://photos.example.test/source"
    });
    const activities = Array.from({ length: 8 }, (_, index) => activity(`stop-${index + 1}`));
    const source = board({
        images,
        coverImageId: 9,
        days: [{ id: "day", dayNumber: 1, date: null, pins: activities }]
    });
    const markup = renderToStaticMarkup(
        createElement(BoardCreationPreview, { board: source, editable: false, author: "known_author" })
    );
    pairedCards(markup);
    assert.doesNotMatch(markup, /href="#/);
    assert.doesNotMatch(markup, /aria-label="(?:Edit|Manage|Review dates|Edit places)/);
    for (const pin of activities) {
        assert.ok(markup.includes(pin.title));
        assert.ok(markup.includes(pin.description));
    }
    for (const image of images) assert.ok(markup.includes(image.thumbnailUrl));
    assert.match(markup, /Original Photographer/);
    assert.match(markup, /href="https:\/\/photos\.example\.test\/photographer"/);
    assert.match(markup, /href="https:\/\/photos\.example\.test\/source"/);
});

test("preview section forwards authorship and editability without fetching extra Board or profile data", (t) => {
    const fetch = t.mock.method(globalThis, "fetch", async () => {
        throw new Error("The preview must use existing editor data");
    });
    const source = board();
    const first = renderToStaticMarkup(
        createElement(BoardPreviewSection, { board: source, author: "known_author", editable: false })
    );
    for (const card of pairedCards(first)) assert.match(card, /by known_author/);
    assert.doesNotMatch(first, /href="#/);
    const changed = { ...source, title: "The revised live title", coverImageId: 22 };
    const next = renderToStaticMarkup(
        createElement(BoardPreviewSection, { board: changed, author: "known_author", editable: false })
    );
    for (const card of pairedCards(next)) {
        assert.match(card, /The revised live title/);
        assert.match(card, /\/images\/22\/content\?variant=display/);
        assert.doesNotMatch(card, /\/images\/23\/content\?variant=display/);
    }
    assert.equal(createBoardPreview(source).photo.id, createBoardPreview(changed).photo.id);
    assert.equal(fetch.mock.callCount(), 0);
});
