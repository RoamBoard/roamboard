import assert from "node:assert/strict";
import test from "node:test";
import { collageBoardExamples, compactBoardExamples } from "../src/data/board-card-examples";
import { filterGalleryBoards, filterLibraryBoards, toGalleryBoard } from "../src/lib/my-boards";
import { mockBoardCollections } from "../src/data/my-board-collections";
import type { BoardDocument, PublishedSummary } from "../src/lib/board-creator-api";

const samples = collageBoardExamples.map((collage, index) => ({ collage, compact: compactBoardExamples[index] }));

test("gallery search matches title, destination, country code and author without case or accent sensitivity", () => {
    for (const query of ["TOKYO", "japan", "JPN", "noah fischer", "hidden ramen"]) {
        assert.equal(filterGalleryBoards(samples, query)[0]?.collage.id, "v1-tokyo");
    }
    assert.equal(filterGalleryBoards(samples, "chloe")[0]?.collage.id, "v1-paris");
    assert.equal(filterGalleryBoards(samples, "   ").length, samples.length);
    assert.equal(filterGalleryBoards(samples, "Tokyo France").length, 0);
    assert.equal(filterGalleryBoards([], "Tokyo").length, 0);
});

test("live gallery cards use persisted content, cover ordering and a real Board route without invented save counts", () => {
    const summary: PublishedSummary = {
        boardId: 18,
        title: "Winter in Stockholm",
        status: "published",
        visibility: "public",
        updatedAt: "2026-10-01",
        coverImageUrl: null
    };
    const document = {
        coverImageId: 2,
        description: "An afternoon in the old town.",
        tags: [{ tagId: 1, name: "Architecture" }],
        images: [1, 2].map((imageId) => ({ imageId, url: `https://example.com/${imageId}.jpg` })),
        days: [
            {
                dayNumber: 1,
                activities: [
                    { title: "Gamla Stan", location: { city: "Stockholm", country: "Sweden" }, externalImage: null }
                ]
            }
        ]
    } as BoardDocument;
    const board = toGalleryBoard(summary, document);
    assert.equal(board.href, "/boards/18");
    assert.equal(board.collage.destinationLabel, "SWE");
    assert.equal(board.collage.durationDays, 1);
    assert.equal(board.compact.image.src, "https://example.com/2.jpg");
    assert.equal(board.collage.savedCount, undefined);
    assert.deepEqual(board.collage.highlights, ["Gamla Stan"]);
    assert.equal(filterGalleryBoards([board], "stockholm").length, 1);
});

test("collection samples keep archived Boards separate, normalize country codes and support independent search", () => {
    const { created, saved, archived } = mockBoardCollections;
    const activeIds = new Set([...created, ...saved].map((board) => board.compact.id));
    assert.ok(archived.every((board) => !activeIds.has(board.compact.id)));
    assert.deepEqual(
        archived.map((board) => board.compact.destinationLabel),
        ["PRT", "NOR", "ESP"]
    );
    assert.equal(filterLibraryBoards(archived, "PORTO portugal").length, 1);
    assert.equal(filterLibraryBoards(archived, "ines").length, 1);
    assert.equal(filterLibraryBoards(archived, "Tokyo").length, 0);
    assert.equal(filterGalleryBoards(saved, "Tokyo").length, 1);
    assert.equal(filterGalleryBoards(created, "Tokyo").length, 1);
    assert.equal(filterLibraryBoards(archived, "zzzz").length, 0);
    assert.ok([...created, ...saved, ...archived].every((board) => !("href" in board)));
});
