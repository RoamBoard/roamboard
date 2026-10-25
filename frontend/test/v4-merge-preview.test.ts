import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BoardCreationPreview from "../src/components/features/boards/BoardCreationPreview";
import BoardCreator from "../src/components/features/boards/BoardCreator";
import BoardPreviewSection from "../src/components/features/boards/BoardPreviewSection";
import { createBoardPreview } from "../src/lib/board-creation-preview";
import { fromBoardDocument, loadBoardDocument, toBoardWrite, type BoardDocument } from "../src/lib/board-creator-api";
import { toSelectionBoard } from "../src/lib/board-selection";
import { toGalleryBoard } from "../src/lib/my-boards";
import { toDraftPhotoBoardCard, toPhotoBoardCard } from "../src/lib/photo-board-card";
import { savePhotoEdit } from "../src/lib/photo-editing";
import { photoWasEdited } from "../src/lib/use-photo-urls";
import type { BoardCreatorPayload } from "../src/types/board-creator";

function source(): BoardCreatorPayload {
    return {
        title: "A journey with a selected region",
        description: "The original full itinerary notes.",
        status: "published",
        visibility: "friends",
        tags: [],
        coverImageId: 8311,
        destination: {
            name: "Bali",
            address: "Bali, Indonesia",
            city: null,
            country: "Indonesia",
            countryCode: "IDN",
            latitude: -8.409518,
            longitude: 115.188919,
            mapboxId: "geoapify:bali",
            kind: "region"
        },
        images: [
            {
                id: "selected-photo",
                uploadedImageId: 8311,
                publicId: "8311",
                source: "upload",
                pinId: "activity",
                url: "/api/v1/images/8311/content?variant=display",
                thumbnailUrl: "/api/v1/images/8311/content?variant=thumbnail",
                width: 1200,
                height: 800,
                capturedAt: null,
                latitude: null,
                longitude: null,
                order: 0,
                activityOrder: 0,
                credit: null,
                creditUrl: null,
                sourceUrl: null
            }
        ],
        days: [
            {
                id: "day",
                dayNumber: 1,
                date: null,
                pins: [
                    {
                        id: "activity",
                        title: "A retained photo activity",
                        description: "The original activity notes.",
                        time: "09:30",
                        order: 0,
                        source: "photo",
                        category: "museum",
                        location: {
                            name: "A real activity place",
                            address: "A saved street address",
                            city: "Oslo",
                            country: "Norway",
                            countryCode: "NOR",
                            latitude: 59.91,
                            longitude: 10.75,
                            mapboxId: null
                        }
                    }
                ]
            }
        ]
    };
}

function savedDocument(): BoardDocument {
    const board = source();
    const write = toBoardWrite(board, []);
    return {
        ...write,
        boardId: 831,
        revision: 4,
        author: { username: "the_actual_author", bio: "", photo: null },
        permissions: { canEditContent: true, canManageBoard: true },
        tags: [],
        images: [
            {
                imageId: 8311,
                url: board.images[0].url,
                thumbnailUrl: board.images[0].thumbnailUrl,
                position: 0,
                capturedAt: null
            }
        ],
        days: write.days.map((day) => ({
            ...day,
            dayId: 51,
            activities: day.activities.map((activity) => ({ ...activity, activityId: 61 }))
        })),
        createdAt: "2026-10-18T12:00:00Z",
        updatedAt: "2026-10-19T12:00:00Z"
    };
}

function cards(markup: string) {
    const result = [...markup.matchAll(/<article\b[^>]*style="aspect-ratio:400 \/ 500"[^>]*>[\s\S]*?<\/article>/g)].map(
        (match) => match[0]
    );
    assert.equal(result.length, 2);
    assert.match(markup, /COVER VIEW/);
    assert.match(markup, /DETAILS VIEW/);
    assert.equal((markup.match(/data-photo-board-expanded="false"/g) ?? []).length, 1);
    assert.equal((markup.match(/data-photo-board-expanded="true"/g) ?? []).length, 1);
    return result;
}

test("an API-restored main destination takes precedence across V4 creator and canonical gallery adapters", async (t) => {
    const document = savedDocument();
    const fetch = t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
        assert.equal(new URL(input).pathname, "/api/v1/boards/831");
        assert.equal(init.credentials, "include");
        return Response.json({ data: document });
    });
    const loaded = await loadBoardDocument(831);
    const summary = {
        boardId: 831,
        title: loaded.title,
        status: "published" as const,
        visibility: loaded.visibility,
        coverImageUrl: loaded.images[0].thumbnailUrl,
        updatedAt: loaded.updatedAt
    };
    for (const photo of [
        toPhotoBoardCard(loaded),
        toDraftPhotoBoardCard(summary, loaded),
        toSelectionBoard({ ...summary, source: "owned" }, loaded).photo,
        toGalleryBoard(summary, loaded).photo
    ]) {
        assert.ok(photo);
        assert.equal(photo.destination, "Bali, Indonesia");
        assert.equal(photo.destinationLabel, "IDN");
        assert.equal(photo.author, "the_actual_author");
        assert.equal(photo.savedCount, undefined);
    }
    const reopened = { ...source(), ...fromBoardDocument(loaded) };
    const before = structuredClone(reopened);
    const preview = createBoardPreview(reopened);
    assert.equal(preview.photo.destination, "Bali, Indonesia");
    assert.equal(preview.photo.destinationLabel, "IDN");
    const markup = renderToStaticMarkup(
        createElement(BoardCreationPreview, { board: reopened, author: loaded.author.username, editable: false })
    );
    const pair = cards(markup);
    assert.match(pair[1], /Bali, Indonesia/);
    assert.match(pair[1], />IDN<|>IDN<\/span>/);
    assert.ok(pair.every((card) => card.includes("the_actual_author")));
    assert.doesNotMatch(markup, /href="#|aria-pressed=|aria-label="(?:Public|Friends|Restricted access) —/);
    assert.match(markup, /A real activity place/);
    assert.deepEqual(reopened, before);
    assert.equal(fetch.mock.callCount(), 1, "V4 presentation must not trigger another Board or profile request");
});

test("confirmed photo-presentation revisions update both V4 display covers and retain full thumbnail reviews", async (t) => {
    const board = source();
    const before = structuredClone(board);
    const requests: number[] = [];
    const edit = { x: 0.1, y: 0.1, width: 0.8, height: 0.8, outputWidth: 1200, outputHeight: 800 };
    t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
        assert.equal(new URL(input).pathname, "/api/v1/images/8311/presentation");
        assert.equal(init.method, "PUT");
        assert.equal(init.credentials, "include");
        assert.equal(init.cache, "no-store");
        const payload = JSON.parse(String(init.body));
        requests.push(payload.revision);
        assert.deepEqual(payload.edit, payload.revision === 7 ? edit : null);
        return Response.json({ data: { edit: payload.edit, revision: payload.revision + 1 } });
    });
    for (const revision of [7, 8]) {
        const saved = await savePhotoEdit(8311, revision, revision === 7 ? edit : null);
        photoWasEdited(8311, saved.revision);
        const markup = renderToStaticMarkup(createElement(BoardCreationPreview, { board }));
        const pair = cards(markup);
        const display = new URL(board.images[0].url, process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001");
        display.searchParams.set("v", String(saved.revision));
        const thumbnail = new URL(
            board.images[0].thumbnailUrl,
            process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
        );
        thumbnail.searchParams.set("v", String(saved.revision));
        const imageSources = [...markup.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((match) =>
            match[1].replaceAll("&amp;", "&")
        );
        for (const card of pair) assert.ok(card.includes(display.toString().replaceAll("&", "&amp;")));
        assert.equal(imageSources.filter((url) => url === display.toString()).length, 2);
        assert.equal(imageSources.filter((url) => url === thumbnail.toString()).length, 1);
        assert.doesNotMatch(markup, /_next\/image/);
        assert.match(markup, /aria-label="Day 1 photos"/);
        assert.match(markup, /The original activity notes/);
        assert.deepEqual(board, before);
    }
    assert.deepEqual(requests, [7, 8]);
});

test("V4 annotations target the real main-destination editor while legacy activity fallback retains the day-plan action", () => {
    const editor = renderToStaticMarkup(createElement(BoardCreator));
    assert.match(editor, /id="board-destination"[\s\S]*?<input[^>]*role="combobox"/);
    assert.match(editor, /id="board-images"[\s\S]*?aria-label="Edit Board cover"/);
    const explicit = renderToStaticMarkup(createElement(BoardPreviewSection, { board: source() }));
    assert.match(explicit, /<a[^>]*href="#board-destination"[^>]*aria-label="Edit main destination"/);
    assert.doesNotMatch(explicit, /aria-label="Edit places in the day plan"/);
    assert.match(explicit, /href="#board-images"[^>]*aria-label="Manage photos"/);
    const fallback = renderToStaticMarkup(
        createElement(BoardPreviewSection, { board: { ...source(), destination: null } })
    );
    assert.match(fallback, /href="#day-plan"[^>]*aria-label="Edit places in the day plan"/);
    assert.doesNotMatch(fallback, /aria-label="Edit main destination"/);
    for (const markup of [explicit, fallback]) cards(markup);
});
