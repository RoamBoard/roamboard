import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BoardDocumentPhotoCard from "../src/components/features/boards/cards/BoardDocumentPhotoCard";
import type { BoardDocument } from "../src/lib/board-creator-api";
import { toPhotoBoardCard } from "../src/lib/photo-board-card";

function document(): BoardDocument {
    return {
        boardId: 71,
        title: "Notes from a real journey",
        description: "A walk through the city.",
        author: { username: "a_very_long_real_author_handle", bio: "", photo: null },
        status: "published",
        visibility: "friends",
        revision: 2,
        coverImageId: 42,
        imageIds: [41, 42],
        tagIds: [9],
        tags: [{ tagId: 9, name: "Architecture" }],
        permissions: { canEditContent: true, canManageBoard: false },
        images: [41, 42].map((imageId) => ({
            imageId,
            url: `/api/v1/images/${imageId}/content?variant=display`,
            thumbnailUrl: `/api/v1/images/${imageId}/content?variant=thumbnail`,
            position: imageId - 41,
            capturedAt: null
        })),
        days: [
            {
                dayId: 1,
                dayNumber: 1,
                date: null,
                activities: [
                    {
                        activityId: 1,
                        position: 0,
                        title: "A walk",
                        activityTime: null,
                        category: "walk",
                        note: null,
                        source: "manual",
                        locationConfirmed: true,
                        location: {
                            name: "City centre",
                            latitude: 59.91,
                            longitude: 10.75,
                            address: null,
                            city: "Oslo",
                            country: "Norway",
                            externalPlaceId: null
                        },
                        uploadedImageIds: [],
                        coverImageId: null,
                        externalImage: null
                    }
                ]
            },
            { dayId: 2, dayNumber: 2, date: null, activities: [] }
        ],
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-02T00:00:00Z"
    };
}

test("V4 document presentation keeps real metadata, full attribution and the chosen protected cover", () => {
    const board = toPhotoBoardCard(document());
    assert.equal(board.id, "71");
    assert.equal(board.title, "Notes from a real journey");
    assert.equal(board.author, "a_very_long_real_author_handle");
    assert.match(board.destination, /Oslo/);
    assert.match(board.destination, /Norway/);
    assert.deepEqual(board.tags, ["Architecture"]);
    assert.equal(board.description, "A walk through the city.");
    assert.equal(board.durationDays, 2);
    assert.equal(board.visibility, "friends");
    assert.equal(board.status, "published");
    assert.equal(board.savedCount, undefined);
    assert.ok(board.image);
    assert.match(board.image.src, /\/api\/v1\/images\/42\/content\?variant=display$/);
    assert.ok(board.image.alt);
});

test("missing metadata and photographs do not fabricate a destination, count, tags or itinerary", () => {
    const source = document();
    const board = toPhotoBoardCard({
        ...source,
        title: "Postcards from Imaginary City",
        description: null,
        coverImageId: null,
        images: [],
        imageIds: [],
        tags: [],
        days: []
    });
    assert.equal(board.image, undefined);
    assert.ok(!board.destination);
    assert.ok(!board.destinationLabel);
    assert.ok(!board.tags?.length);
    assert.ok(!board.description);
    assert.equal(board.savedCount, undefined);
    assert.ok(!board.durationDays);
});

test("unconfirmed locations cannot become claimed Board destinations", () => {
    const source = document();
    const activity = source.days[0].activities[0];
    const board = toPhotoBoardCard({
        ...source,
        days: [{ ...source.days[0], activities: [{ ...activity, locationConfirmed: false }] }]
    });
    assert.ok(!board.destination);
    assert.ok(!board.destinationLabel);
});

test("an absent selected cover uses another real Board photo without inventing an editorial replacement", () => {
    const source = document();
    const board = toPhotoBoardCard({ ...source, coverImageId: 999 });
    assert.ok(board.image);
    assert.match(board.image.src, /\/api\/v1\/images\/(41|42)\/content\?variant=display$/);
    const draft = toPhotoBoardCard({ ...source, status: "draft", visibility: "public" });
    assert.equal(draft.status, "draft");
    assert.equal(draft.visibility, "public", "The configured publication visibility must not be rewritten");
});

test("external cover fallbacks preserve their original photographer and source attribution", () => {
    const source = document();
    const externalImage = {
        provider: "unsplash" as const,
        providerImageId: "real-provider-photo",
        url: "https://images.unsplash.com/photo-actual-provider-reference",
        photographer: "The Original Photographer",
        photographerUrl: "https://unsplash.com/@originalphotographer",
        sourceUrl: "https://unsplash.com/photos/real-provider-photo"
    };
    const board = toPhotoBoardCard({
        ...source,
        images: [],
        imageIds: [],
        coverImageId: null,
        days: [
            {
                ...source.days[0],
                activities: [{ ...source.days[0].activities[0], externalImage }]
            }
        ]
    });
    assert.ok(board.image);
    assert.equal(board.image.src, externalImage.url);
    assert.equal(board.image.credit, externalImage.photographer);
    assert.equal(board.image.creditUrl, externalImage.photographerUrl);
    assert.equal(board.image.sourceUrl, externalImage.sourceUrl);
    const uploaded = toPhotoBoardCard(source);
    assert.equal(uploaded.image?.credit, undefined, "A protected upload must not inherit another photo's credit");
});

test("the live document integration resolves ownership from management permission, never author name or edit access", () => {
    const source = document();
    const render = (document: BoardDocument) =>
        renderToStaticMarkup(createElement(BoardDocumentPhotoCard, { document }));
    const editor = render({ ...source, savedByMe: false });
    assert.match(editor, /aria-label="Save Notes from a real journey"/);
    assert.match(editor, /aria-pressed="false"/);
    assert.match(editor, /href="\/boards\/71"/);
    assert.doesNotMatch(editor, /aria-label="Friends —/);
    const owner = render({
        ...source,
        savedByMe: false,
        permissions: { canEditContent: true, canManageBoard: true }
    });
    assert.match(owner, /aria-label="Friends —/);
    assert.doesNotMatch(owner, /aria-pressed=|aria-label="Save Notes/);
    const alreadySaved = render({ ...source, savedByMe: true });
    assert.match(alreadySaved, /aria-label="Unsave Notes from a real journey"/);
    assert.match(alreadySaved, /aria-pressed="true"/);
    const unknownSave = render(source);
    assert.match(unknownSave, /Save status unavailable/);
    assert.doesNotMatch(unknownSave, /aria-pressed="false"/);
    const draft = render({
        ...source,
        status: "draft",
        visibility: "public",
        permissions: { canEditContent: true, canManageBoard: true }
    });
    assert.match(draft, /Draft — only you/);
    assert.match(draft, /href="\/boards\/drafts\/71"/);
});
