import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import BoardCreationPreview from "../src/components/features/boards/BoardCreationPreview";
import type { BoardCreatorPayload } from "../src/types/board-creator";

test("preview shows one Board cover and the photos linked to an activity", () => {
    const board: BoardCreatorPayload = {
        title: "City walk",
        description: "",
        status: "draft",
        visibility: "collaborators",
        coverImageId: 2,
        tags: [],
        images: [
            {
                id: "photo-1",
                uploadedImageId: 1,
                pinId: "pin-1",
                publicId: "1",
                source: "upload",
                url: "/image/1",
                thumbnailUrl: "/thumb/1",
                width: 0,
                height: 0,
                capturedAt: null,
                latitude: null,
                longitude: null,
                order: 0,
                activityOrder: 1,
                credit: null,
                creditUrl: null,
                sourceUrl: null
            },
            {
                id: "photo-2",
                uploadedImageId: 2,
                pinId: "pin-1",
                publicId: "2",
                source: "upload",
                url: "/image/2",
                thumbnailUrl: "/thumb/2",
                width: 0,
                height: 0,
                capturedAt: null,
                latitude: null,
                longitude: null,
                order: 1,
                activityOrder: 0,
                credit: null,
                creditUrl: null,
                sourceUrl: null
            }
        ],
        days: [
            {
                id: "day-1",
                dayNumber: 1,
                date: null,
                pins: [
                    {
                        id: "pin-1",
                        order: 0,
                        time: "10:00",
                        title: "Museum",
                        description: "",
                        category: "museum",
                        source: "manual",
                        location: null
                    }
                ]
            }
        ]
    };
    const markup = renderToStaticMarkup(createElement(BoardCreationPreview, { board }));
    assert.equal((markup.match(/alt="Cover of City walk"/g) ?? []).length, 1);
    assert.match(markup, /src="\/image\/2"/);
    assert.match(markup, /aria-label="Images for Museum"/);
    assert.match(markup, /src="\/thumb\/1"/);
    assert.match(markup, /src="\/thumb\/2"/);
    assert.doesNotMatch(markup, /Cover images/);
});
