import assert from "node:assert/strict";
import test from "node:test";
import { createBoardSchema } from "../src/features/boards/boards.schemas.js";

const external = {
    source: "unsplash",
    providerImageId: "red-boat",
    url: "https://images.unsplash.com/red-boat?ixid=credit",
    thumbnailUrl: "https://images.unsplash.com/red-boat?ixid=credit&w=400",
    alt: "Red boat",
    photographer: "Photographer",
    photographerUrl: "https://unsplash.com/@photographer",
    sourceUrl: "https://unsplash.com/photos/red-boat",
    width: 1600,
    height: 2400,
    context: null,
    presentation: null
};
function board(media: Record<string, unknown>) {
    return {
        title: "Weekend",
        description: null,
        status: "draft",
        visibility: "collaborators",
        tagIds: [],
        imageIds: [42],
        days: [
            {
                dayNumber: 1,
                date: null,
                activities: [
                    {
                        title: "Stop",
                        position: 0,
                        activityTime: null,
                        category: "museum",
                        note: null,
                        source: "manual",
                        location: null,
                        locationConfirmed: false,
                        ...media
                    }
                ]
            }
        ]
    };
}

test("mixed attachment writes retain interleaved source order, source-specific cover and external crop", () => {
    const photos = [
        external,
        { source: "upload", imageId: 42 },
        {
            ...external,
            providerImageId: "second-photo",
            presentation: {
                x: 0.1,
                y: 0.2,
                width: 0.7,
                height: 0.6,
                outputWidth: 800,
                outputHeight: 600
            }
        }
    ];
    const coverPhoto = { source: "unsplash", providerImageId: "second-photo" };
    const activity = createBoardSchema.parse(board({ photos, coverPhoto })).days[0]!.activities[0]!;
    assert.deepEqual(activity.photos, photos);
    assert.deepEqual(activity.coverPhoto, coverPhoto);
    assert.deepEqual(
        createBoardSchema.parse(board({ photos: [], coverPhoto: null })).days[0]!.activities[0]!.photos,
        []
    );
});

test("new attachment writes reject duplicate identities, mixed legacy fields and malformed media without coercion", () => {
    for (const media of [
        { photos: null },
        { photos: [external, external] },
        {
            photos: [
                { source: "upload", imageId: 42 },
                { source: "upload", imageId: 42 }
            ]
        },
        { photos: [external], uploadedImageIds: [] },
        { photos: [external], externalImage: null },
        { photos: [external], coverImageId: null },
        { photos: [{ ...external, source: "pexels" }] },
        { photos: [{ ...external, url: "https://evil.example/photo" }] },
        { photos: [{ ...external, thumbnailUrl: "https://images.unsplash.com.evil.example/photo" }] },
        { photos: [{ source: "upload", imageId: "42" }] }
    ])
        assert.equal(createBoardSchema.safeParse(board(media)).success, false, JSON.stringify(media));
});

test("external crops enforce normalized bounds and upload-equivalent output limits", () => {
    for (const presentation of [
        { x: -0.1, y: 0, width: 1, height: 1, outputWidth: 800, outputHeight: 600 },
        { x: 0.2, y: 0, width: 0.9, height: 1, outputWidth: 800, outputHeight: 600 },
        { x: 0, y: 0.4, width: 1, height: 0.7, outputWidth: 800, outputHeight: 600 },
        { x: 0, y: 0, width: 0, height: 1, outputWidth: 800, outputHeight: 600 },
        { x: 0, y: 0, width: 1, height: 1, outputWidth: 31, outputHeight: 600 },
        { x: 0, y: 0, width: 1, height: 1, outputWidth: 4097, outputHeight: 600 },
        { x: 0, y: 0, width: 1, height: 1, outputWidth: 800.5, outputHeight: 600 }
    ])
        assert.equal(createBoardSchema.safeParse(board({ photos: [{ ...external, presentation }] })).success, false);
});
