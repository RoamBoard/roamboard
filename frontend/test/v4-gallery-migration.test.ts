import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BoardLibrary from "../src/components/features/boards/BoardLibrary";
import SpatialGallery from "../src/components/features/boards/SpatialGallery";
import { DestinationStories } from "../src/components/features/destinations/DestinationStories";
import { mockBoardCollections } from "../src/data/my-board-collections";
import type { BoardDocument, PublishedSummary } from "../src/lib/board-creator-api";
import { toGalleryBoard } from "../src/lib/my-boards";
import type { DestinationBoardSummary } from "../src/lib/destination-guides";

function ownedBoard(boardId: number, visibility: BoardDocument["visibility"] = "public") {
    const summary: PublishedSummary = {
        boardId,
        title: `Owner journey ${boardId}`,
        status: "published",
        visibility,
        updatedAt: "2026-10-18T00:00:00Z",
        coverImageUrl: null
    };
    const document: BoardDocument = {
        boardId,
        title: summary.title,
        author: { username: "actual_owner_username", bio: "", photo: null },
        description: "Notes from an actual owned Board.",
        status: "published",
        visibility,
        revision: 3,
        tagIds: [2],
        tags: [{ tagId: 2, name: "Architecture" }],
        imageIds: [10],
        coverImageId: 10,
        permissions: { canEditContent: true, canManageBoard: true },
        images: [
            {
                imageId: 10,
                url: "/api/v1/images/10/content?variant=display",
                thumbnailUrl: "/api/v1/images/10/content?variant=thumbnail",
                position: 0,
                capturedAt: null
            }
        ],
        days: [],
        createdAt: "2026-10-17T00:00:00Z",
        updatedAt: summary.updatedAt
    };
    return toGalleryBoard(summary, document);
}

function cards(markup: string) {
    return [...markup.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map((match) => match[0]);
}

function requireV4(markup: string, count: number) {
    const rendered = cards(markup);
    assert.equal(rendered.length, count);
    for (const card of rendered) assert.match(card, /aspect-ratio:400 \/ 500/);
    return rendered;
}

function selectionButtons(markup: string) {
    return [...markup.matchAll(/<button\b[^>]*aria-label="Select [^"]*"[^>]*>/g)].map((match) => match[0]);
}

test("My Boards featured gallery renders canonical V4 metadata and owner visibility without account-save controls", () => {
    const boards = [ownedBoard(51), ownedBoard(52, "friends")];
    const markup = renderToStaticMarkup(createElement(SpatialGallery, { boards }));
    const rendered = requireV4(markup, 2);
    assert.ok(rendered.every((card) => card.includes("actual_owner_username")));
    assert.match(rendered[0], /aria-label="Public — anyone can view this Board"/);
    assert.match(rendered[1], /aria-label="Friends —/);
    assert.match(rendered[0], /Notes from an actual owned Board/);
    assert.match(rendered[0], /Architecture/);
    assert.match(markup, /href="\/boards\/51"/);
    assert.doesNotMatch(markup, /href="\/boards\/52"/);
    assert.doesNotMatch(markup, /aria-label="(?:Save|Unsave) |0 saves|Destination not added|globe\.svg/);
    const opens = [...markup.matchAll(/<a\b[^>]*aria-label="Open [^"]*"[^>]*>/g)].map((match) => match[0]);
    assert.equal(opens.length, 1);
    assert.match(opens[0], /tabindex="0"/);
    assert.equal(selectionButtons(markup).length, 1);
    assert.doesNotMatch(markup, />(?:Details|Close)(?:<|$)/);
    assert.match(markup, /aria-label="Previous Board"/);
    assert.match(markup, /aria-label="Next Board"/);
    assert.match(markup, /aria-live="polite"/);
});

test("recently created library retains real Board links and carousel affordances while rendering shared V4", () => {
    const boards = [ownedBoard(61), ownedBoard(62, "collaborators")];
    const markup = renderToStaticMarkup(
        createElement(BoardLibrary, {
            boards,
            title: "RECENTLY CREATED",
            hasMore: true
        })
    );
    const rendered = requireV4(markup, 2);
    assert.ok(rendered.every((card) => card.includes("actual_owner_username")));
    assert.match(markup, /href="\/boards\/61"/);
    assert.match(markup, /href="\/boards\/62"/);
    assert.match(markup, /Restricted access — you and invited Board members/);
    assert.equal((markup.match(/aria-label="Board details"/g) ?? []).length, 2);
    assert.equal((markup.match(/aria-label="Show details for /g) ?? []).length, 2);
    assert.equal((markup.match(/aria-expanded="false"/g) ?? []).length, 2);
    assert.doesNotMatch(markup, />(?:Details|Close)(?:<|$)/);
    assert.equal(selectionButtons(markup).length, 0, "Library cards navigate rather than select");
    assert.match(markup, /aria-roledescription="carousel"/);
    assert.match(markup, /Previous recently created Boards/);
    assert.match(markup, /Next recently created Boards/);
    assert.match(markup, /type="range"[^>]*aria-label="RECENTLY CREATED scroll position"/);
    assert.match(markup, /2 Boards · drag, swipe or scroll to explore/);
    assert.doesNotMatch(markup, /aria-label="(?:Save|Unsave) |0 saves/);
});

test("featured browsing retains ten canonical cards and their direct views without the old footer link", () => {
    const boards = Array.from({ length: 10 }, (_, index) => ownedBoard(100 + index));
    const markup = renderToStaticMarkup(createElement(SpatialGallery, { boards }));
    requireV4(markup, 10);
    assert.ok(markup.includes(`href="${boards[0].href}"`));
    assert.equal(selectionButtons(markup).length, 9);
    assert.match(markup, /01 \/ 10/);
    assert.match(markup, /aria-label="View Owner journey 100"/);
    assert.match(markup, /aria-label="Edit Owner journey 100"/);
    assert.doesNotMatch(markup, />open Board|>Open Board/);
});

test("visual sample galleries and libraries never acquire owner controls, persistence claims, sample URLs or fixture save totals", () => {
    const featured = renderToStaticMarkup(createElement(SpatialGallery, { boards: mockBoardCollections.created }));
    requireV4(featured, mockBoardCollections.created.length);
    const library = renderToStaticMarkup(
        createElement(BoardLibrary, {
            boards: mockBoardCollections.saved,
            title: "VISUAL EXAMPLES",
            description: "Sample collection · not connected to account state."
        })
    );
    requireV4(library, mockBoardCollections.saved.length);
    assert.match(library, /Sample collection/);
    for (const markup of [featured, library]) {
        assert.doesNotMatch(markup, /href=|aria-label="(?:Save|Unsave|Public|Friends|Restricted access) /);
        assert.doesNotMatch(markup, /[\d,]+ saves|saved to your collection/i);
    }
});

function publicBoard(boardId: number, changes: Partial<DestinationBoardSummary> = {}): DestinationBoardSummary {
    return {
        boardId,
        username: `public_author_${boardId}`,
        title: `Public journey ${boardId}`,
        description: "A traveller's persisted trip notes.",
        durationDays: 3,
        tags: ["Architecture", "Food"],
        activityTitles: ["Riverside walk"],
        images: [{ url: `/api/v1/images/${boardId}/content?variant=display&revision=4`, alt: "Chosen Board cover" }],
        ...changes
    };
}

function renderPublicBoards(boards: DestinationBoardSummary[], extra = {}) {
    return renderToStaticMarkup(
        createElement(DestinationStories, { name: "Kyoto", countryCode: "JPN", boards, ...extra })
    );
}

test("public destination Boards render V4 metadata with real background view links", () => {
    const boards = [publicBoard(771), publicBoard(772)];
    const markup = renderPublicBoards(boards);
    const rendered = requireV4(markup, boards.length);
    assert.match(markup, /Boards in and around Kyoto/);
    assert.match(markup, /aria-roledescription="carousel"/);
    assert.match(markup, /aria-label="Previous Board"/);
    assert.match(markup, /aria-label="Next Board"/);
    assert.equal(selectionButtons(markup).length, 1);
    assert.match(markup, /href="\/boards\/771"/);
    assert.doesNotMatch(markup, /href="\/boards\/772"/);
    assert.match(markup, /aria-label="Open Public journey 771"/);
    assert.doesNotMatch(markup, />Open Board/);
    assert.doesNotMatch(markup, /Sample Boards|Illustrative content|>(?:Details|Close)(?:<|$)/);
    assert.match(markup, /aria-label="Public — anyone can view this Board"/);
    assert.doesNotMatch(markup, /aria-label="(?:Save |Unsave )|[\d,]+ saves/);
    assert.match(markup, /aria-live="polite"/);
    for (const [index, card] of rendered.entries()) {
        assert.match(card, new RegExp(boards[index].username));
    }
    assert.match(rendered[0], /persisted trip notes/);
    assert.match(rendered[0], /Architecture/);
    assert.match(rendered[0], /Food/);
    assert.match(rendered[0], /3 days/);
    assert.match(rendered[0], /data-photo-board-field="destination"[^>]*>Kyoto</);
});

test("public destination cards keep the chosen protected cover URL and never substitute an activity photo", () => {
    const board = publicBoard(781);
    board.images.push({ url: "https://images.unsplash.com/unselected-activity.jpg", alt: "Unselected activity" });
    const markup = renderPublicBoards([board]);
    assert.ok(
        markup.includes(
            `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/v1/images/781/content?variant=display&amp;revision=4`
        )
    );
    assert.doesNotMatch(markup, /unselected-activity|_next\/image/);
});

test("public destination cards retain provider delivery without a layout-shifting credit or invented metadata", () => {
    const markup = renderPublicBoards([
        publicBoard(791, {
            description: null,
            tags: [],
            durationDays: 0,
            images: [
                {
                    url: "https://images.unsplash.com/real-cover.jpg?ixid=original-tracking&w=640",
                    alt: "Author's chosen station",
                    photographer: "Actual Photographer",
                    photographerUrl: "https://unsplash.com/@actual-photographer",
                    sourceUrl: "https://unsplash.com/photos/real-cover"
                }
            ]
        })
    ]);
    requireV4(markup, 1);
    assert.match(markup, /src="https:\/\/images\.unsplash\.com\/real-cover\.jpg\?ixid=original-tracking/);
    assert.doesNotMatch(markup, /Actual Photographer|Photo by|href="https:\/\/unsplash\.com/);
    assert.doesNotMatch(markup, /0 saves|data-photo-board-field="(?:tags|duration)"|persisted trip notes/);
});

test("public destination Boards without saved covers have an honest V4 fallback and a real navigation target", () => {
    const markup = renderPublicBoards([publicBoard(801, { images: [] })]);
    const [card] = requireV4(markup, 1);
    assert.match(markup, /href="\/boards\/801"/);
    assert.match(card, /No cover photo/);
    assert.doesNotMatch(card, /<img\b|globe\.svg|aria-label="(?:Save|Unsave) /);
});

test("empty libraries and galleries preserve their empty presentation and progressive-loading announcements", () => {
    assert.equal(renderToStaticMarkup(createElement(SpatialGallery, { boards: [] })), "");
    const emptyPublic = renderPublicBoards([]);
    assert.match(emptyPublic, /No public Boards in and around Kyoto yet/);
    assert.equal(cards(emptyPublic).length, 0);
    const empty = renderToStaticMarkup(createElement(BoardLibrary, { boards: [], title: "RECENTLY CREATED" }));
    assert.match(empty, /No recently created Boards match your search/);
    assert.equal(cards(empty).length, 0);
    const pending = renderToStaticMarkup(
        createElement(BoardLibrary, {
            boards: [ownedBoard(81)],
            loadingMore: true,
            hasMore: true
        })
    );
    requireV4(pending, 1);
    assert.doesNotMatch(pending, /Loading more Boards/);
    assert.match(pending, /1 Board/);
});
