import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import PublishedBoardView from "../src/components/features/boards/PublishedBoardView";
import type { BoardDocument } from "../src/lib/board-creator-api";

test("published board view renders all activities without 5-pin truncation and includes pin notes and location", () => {
    const sampleBoard: BoardDocument = {
        boardId: 42,
        revision: 1,
        title: "Kyoto Highlights",
        description: "A wonderful multi-day trip.",
        status: "published",
        visibility: "public",
        coverImageId: 10,
        tagIds: [1],
        imageIds: [10],
        tags: [{ tagId: 1, name: "japan" }],
        permissions: { canEditContent: false, canManageBoard: false },
        createdAt: "2026-10-14T00:00:00Z",
        updatedAt: "2026-10-14T00:00:00Z",
        images: [
            {
                imageId: 10,
                url: "/images/fushimi.jpg",
                thumbnailUrl: "/thumbs/fushimi.jpg",
                capturedAt: null,
                position: 0
            }
        ],
        days: [
            {
                dayId: 1,
                dayNumber: 1,
                date: "2026-10-15",
                activities: [
                    {
                        activityId: 101,
                        position: 0,
                        title: "Fushimi Inari Taisha",
                        activityTime: "09:00",
                        category: "sightseeing",
                        note: "Wake up early to walk through thousand torii gates.",
                        source: "photo",
                        locationConfirmed: false,
                        uploadedImageIds: [10],
                        coverImageId: null,
                        externalImage: null,
                        location: {
                            name: "Fushimi Inari Shrine",
                            address: "68 Fukakusa Yabunouchicho",
                            city: "Kyoto",
                            country: "Japan",
                            latitude: 34.9671,
                            longitude: 135.7727,
                            externalPlaceId: null
                        }
                    },
                    {
                        activityId: 102,
                        position: 1,
                        title: "Kiyomizu-dera",
                        activityTime: "11:00",
                        category: "sightseeing",
                        note: "Historic wooden temple overlooking the city.",
                        source: "manual",
                        locationConfirmed: false,
                        uploadedImageIds: [],
                        coverImageId: null,
                        externalImage: null,
                        location: null
                    },
                    {
                        activityId: 103,
                        position: 2,
                        title: "Lunch at Nishiki Market",
                        activityTime: "12:30",
                        category: "food",
                        note: "",
                        source: "manual",
                        locationConfirmed: false,
                        uploadedImageIds: [],
                        coverImageId: null,
                        externalImage: null,
                        location: null
                    },
                    {
                        activityId: 104,
                        position: 3,
                        title: "Gion Walk",
                        activityTime: "14:00",
                        category: "walk",
                        note: "",
                        source: "manual",
                        locationConfirmed: false,
                        uploadedImageIds: [],
                        coverImageId: null,
                        externalImage: null,
                        location: null
                    },
                    {
                        activityId: 105,
                        position: 4,
                        title: "Yasaka Shrine",
                        activityTime: "15:30",
                        category: "sightseeing",
                        note: "",
                        source: "manual",
                        locationConfirmed: false,
                        uploadedImageIds: [],
                        coverImageId: null,
                        externalImage: null,
                        location: null
                    },
                    {
                        activityId: 106,
                        position: 5,
                        title: "Pontocho Alley",
                        activityTime: "17:00",
                        category: "food",
                        note: "Sixth activity of the day.",
                        source: "manual",
                        locationConfirmed: false,
                        uploadedImageIds: [],
                        coverImageId: null,
                        externalImage: null,
                        location: null
                    },
                    {
                        activityId: 107,
                        position: 6,
                        title: "Kamogawa Riverside",
                        activityTime: "19:00",
                        category: "nature",
                        note: "Seventh activity of the day.",
                        source: "manual",
                        locationConfirmed: false,
                        uploadedImageIds: [],
                        coverImageId: null,
                        externalImage: null,
                        location: null
                    }
                ]
            }
        ]
    };

    const markup = renderToStaticMarkup(
        createElement(PublishedBoardView, {
            boardId: "42",
            initialBoard: sampleBoard
        })
    );

    // Verifies all 7 pins are rendered (no .slice(0, 5))
    assert.match(markup, /Fushimi Inari Taisha/);
    assert.match(markup, /Kiyomizu-dera/);
    assert.match(markup, /Lunch at Nishiki Market/);
    assert.match(markup, /Gion Walk/);
    assert.match(markup, /Yasaka Shrine/);
    assert.match(markup, /Pontocho Alley/);
    assert.match(markup, /Kamogawa Riverside/);

    // Verifies pin notes / descriptions are displayed
    assert.match(
        markup,
        /Wake up early to walk through thousand torii gates\./
    );
    assert.match(markup, /Historic wooden temple overlooking the city\./);
    assert.match(markup, /Sixth activity of the day\./);
    assert.match(markup, /Seventh activity of the day\./);

    // Verifies pin location details are displayed
    assert.match(markup, /68 Fukakusa Yabunouchicho/);
    assert.match(markup, /Kyoto/);
    assert.match(markup, /Japan/);

    // Verifies cover and image thumbnails
    assert.match(markup, /alt="Cover of Kyoto Highlights"/);
    assert.match(markup, /thumbs\/fushimi\.jpg/);
});
