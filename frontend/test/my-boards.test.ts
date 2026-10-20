import assert from "node:assert/strict";
import test from "node:test";
import { toGalleryBoard } from "../src/lib/my-boards";
import { mockBoardCollections } from "../src/data/my-board-collections";
import type { BoardDocument, PublishedSummary } from "../src/lib/board-creator-api";

test("live gallery cards use persisted content, cover ordering and a real Board route without invented save counts", () => {
    const summary: PublishedSummary = {
        boardId: 18,
        title: "Winter in Stockholm",
        status: "published",
        visibility: "public",
        updatedAt: "2026-10-01",
        coverImageUrl: null
    };
    // The chosen cover must win even when it is not first in the API's image array.
    const document: BoardDocument = {
        boardId: summary.boardId,
        title: summary.title,
        status: "published",
        visibility: "public",
        revision: 1,
        imageIds: [1, 2],
        tagIds: [1],
        permissions: { canEditContent: true, canManageBoard: true },
        createdAt: "2026-10-01",
        updatedAt: "2026-10-01",
        author: { username: "stockholm_traveller", bio: "", photo: null },
        coverImageId: 2,
        description: "An afternoon in the old town.",
        tags: [{ tagId: 1, name: "Architecture" }],
        images: [1, 2].map((imageId) => ({
            imageId,
            url: `https://example.com/${imageId}.jpg`,
            thumbnailUrl: `https://example.com/${imageId}-thumb.jpg`,
            position: imageId - 1,
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
                        title: "Gamla Stan",
                        activityTime: null,
                        category: "walk",
                        note: null,
                        source: "manual",
                        locationConfirmed: true,
                        location: {
                            name: "Gamla Stan",
                            latitude: 59.325,
                            longitude: 18.071,
                            address: null,
                            city: "Stockholm",
                            country: "Sweden",
                            externalPlaceId: null
                        },
                        uploadedImageIds: [],
                        coverImageId: null,
                        externalImage: null
                    }
                ]
            }
        ]
    };
    const board = toGalleryBoard(summary, document);
    assert.equal(board.href, "/boards/18");
    assert.equal(board.collage.destinationLabel, "SWE");
    assert.equal(board.collage.durationDays, 1);
    assert.equal(board.compact.image.src, "https://example.com/2.jpg");
    assert.equal(board.collage.savedCount, undefined);
    assert.deepEqual(board.collage.highlights, ["Gamla Stan"]);
    assert.equal(board.ownership, "owner");
    assert.equal(board.photo?.title, document.title);
    assert.equal(board.photo?.author, "stockholm_traveller");
    assert.equal(board.photo?.image?.src, "https://example.com/2.jpg");
    assert.equal(board.photo?.destination, "Stockholm, Sweden");
    assert.equal(board.photo?.durationDays, 1);
    assert.deepEqual(board.photo?.tags, ["Architecture"]);
    assert.equal(board.photo?.status, "published");
    assert.equal(board.photo?.visibility, "public");
    assert.equal(board.photo?.savedCount, undefined);
});

test("created and saved visual samples normalize countries without account routes", () => {
    const { created, saved } = mockBoardCollections;
    assert.ok(created.every((board) => /^[A-Z]{3}$/.test(board.compact.destinationLabel)));
    assert.ok([...created, ...saved].every((board) => !("href" in board)));
});
