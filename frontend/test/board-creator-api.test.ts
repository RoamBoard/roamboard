import assert from "node:assert/strict";
import test from "node:test";

import {
    fromBoardDocument,
    listBoardDrafts,
    listPublishedBoards,
    mergeServerIds,
    mergeServerImages,
    saveBoardDocument,
    toBoardWrite,
    uploadBoardImage,
    type BoardDocument
} from "../src/lib/board-creator-api";
import type { BoardCreatorPayload } from "../src/types/board-creator";

const draft: BoardCreatorPayload = {
    status: "draft",
    title: "Tokyo",
    description: "A trip",
    visibility: "collaborators",
    coverImageId: 12,
    tags: ["Food"],
    images: [
        {
            id: "image-local",
            uploadedImageId: 12,
            pinId: "pin-local",
            publicId: "12",
            source: "upload",
            url: "http://localhost:3001/image/12",
            thumbnailUrl: "http://localhost:3001/thumbnail/12",
            width: 0,
            height: 0,
            capturedAt: "2026-05-01T10:00:00Z",
            latitude: 35.68,
            longitude: 139.76,
            order: 0,
            credit: null,
            creditUrl: null,
            sourceUrl: null
        }
    ],
    days: [
        {
            id: "day-local",
            serverDayId: 7,
            dayNumber: 1,
            date: "2026-05-01",
            pins: [
                {
                    id: "pin-local",
                    serverActivityId: 25,
                    order: 0,
                    time: "10:00",
                    title: "Museum",
                    description: "Visit",
                    category: "museum",
                    source: "photo",
                    location: {
                        name: "Museum",
                        address: "Tokyo",
                        latitude: 35.68,
                        longitude: 139.76,
                        country: "Japan",
                        countryCode: "JPN",
                        city: "Tokyo",
                        mapboxId: null
                    }
                }
            ]
        }
    ]
};

test("creator mapping preserves IDs and accepts generated photo locations without individual saves", () => {
    const tags = [{ tagId: 3, name: "Food" }];
    const unconfirmed = toBoardWrite(draft, tags);
    assert.deepEqual(unconfirmed.tagIds, [3]);
    assert.deepEqual(unconfirmed.imageIds, [12]);
    assert.equal(unconfirmed.days[0]?.dayId, 7);
    assert.equal(unconfirmed.days[0]?.activities[0]?.activityId, 25);
    assert.deepEqual(unconfirmed.days[0]?.activities[0]?.uploadedImageIds, [12]);
    assert.equal(unconfirmed.days[0]?.activities[0]?.locationConfirmed, true);
    const confirmed = toBoardWrite(draft, tags);
    assert.equal(confirmed.days[0]?.activities[0]?.locationConfirmed, true);
    assert.equal(confirmed.days[0]?.activities[0]?.coverImageId, 12);
    assert.equal(confirmed.days[0]?.activities[0]?.location?.latitude, 35.68);
    assert.throws(() => toBoardWrite({ ...draft, tags: ["Unknown"] }, tags), /allowed list/);
});

test("one Board cover is independent of multiple ordered images on an activity", () => {
    const secondImage = {
        ...draft.images[0]!,
        id: "second-image",
        uploadedImageId: 13,
        publicId: "13",
        order: 1,
        activityOrder: 0
    };
    const payload: BoardCreatorPayload = {
        ...draft,
        coverImageId: 13,
        images: [{ ...draft.images[0]!, activityOrder: 1 }, secondImage],
        days: [
            {
                ...draft.days[0]!,
                pins: [{ ...draft.days[0]!.pins[0]!, coverImageId: 12 }]
            }
        ]
    };
    const write = toBoardWrite(payload, [{ tagId: 3, name: "Food" }]);
    assert.equal(write.coverImageId, 13);
    assert.deepEqual(write.imageIds, [12, 13]);
    assert.deepEqual(write.days[0]?.activities[0]?.uploadedImageIds, [13, 12]);
    assert.equal(write.days[0]?.activities[0]?.coverImageId, 12);
    const saved: BoardDocument = {
        ...write,
        boardId: 5,
        author: { username: "test_owner", bio: "", photo: null },
        revision: 2,
        permissions: { canEditContent: true, canManageBoard: true },
        tags: [{ tagId: 3, name: "Food" }],
        images: [12, 13].map((imageId, position) => ({
            imageId,
            position,
            url: `/api/v1/images/${imageId}/content?variant=display`,
            thumbnailUrl: `/api/v1/images/${imageId}/content?variant=thumbnail`,
            capturedAt: null
        })),
        days: [
            {
                ...write.days[0]!,
                dayId: 7,
                activities: [{ ...write.days[0]!.activities[0]!, activityId: 25 }]
            }
        ],
        createdAt: "2026-05-01T00:00:00Z",
        updatedAt: "2026-05-01T00:00:00Z"
    };
    const restored = fromBoardDocument(saved);
    assert.equal(restored.images.filter((image) => image.pinId !== null).length, 2);
    const roundTrip = toBoardWrite(
        {
            ...payload,
            days: restored.days,
            images: restored.images
        },
        saved.tags
    );
    assert.equal(roundTrip.coverImageId, 13);
    assert.deepEqual(roundTrip.days[0]?.activities[0]?.uploadedImageIds, [13, 12]);
    assert.equal(roundTrip.days[0]?.activities[0]?.coverImageId, 12);
});

test("explicit null coverImageId preserves null to keep external image as activity cover", () => {
    const payload: BoardCreatorPayload = {
        ...draft,
        coverImageId: 12,
        images: [
            draft.images[0]!,
            {
                id: "external-img",
                pinId: "pin-local",
                publicId: "unsplash-1",
                source: "unsplash",
                url: "https://images.unsplash.com/photo-1",
                thumbnailUrl: "https://images.unsplash.com/photo-1",
                width: 800,
                height: 600,
                capturedAt: null,
                latitude: null,
                longitude: null,
                order: 1,
                credit: "Photographer",
                creditUrl: null,
                sourceUrl: null
            }
        ],
        days: [
            {
                ...draft.days[0]!,
                pins: [{ ...draft.days[0]!.pins[0]!, coverImageId: null }]
            }
        ]
    };
    const write = toBoardWrite(payload, [{ tagId: 3, name: "Food" }]);
    assert.deepEqual(write.days[0]?.activities[0]?.uploadedImageIds, [12]);
    assert.equal(write.days[0]?.activities[0]?.coverImageId, null);
    assert.equal(write.days[0]?.activities[0]?.externalImage?.providerImageId, "unsplash-1");

    // Reopening the saved Board via fromBoardDocument and saving again preserves null coverImageId
    const saved: BoardDocument = {
        ...write,
        boardId: 10,
        author: { username: "test_owner", bio: "", photo: null },
        revision: 1,
        permissions: { canEditContent: true, canManageBoard: true },
        tags: [{ tagId: 3, name: "Food" }],
        images: [
            {
                imageId: 12,
                position: 0,
                url: "/api/v1/images/12/content?variant=display",
                thumbnailUrl: "/api/v1/images/12/content?variant=thumbnail",
                capturedAt: null
            }
        ],
        days: [
            {
                ...write.days[0]!,
                dayId: 7,
                activities: [{ ...write.days[0]!.activities[0]!, activityId: 25 }]
            }
        ],
        createdAt: "2026-05-01T00:00:00Z",
        updatedAt: "2026-05-01T00:00:00Z"
    };
    const restored = fromBoardDocument(saved);
    assert.equal(restored.days[0]?.pins[0]?.coverImageId, null);
    const roundTrip = toBoardWrite(
        {
            ...payload,
            days: restored.days,
            images: restored.images
        },
        saved.tags
    );
    assert.equal(roundTrip.days[0]?.activities[0]?.coverImageId, null);
    assert.deepEqual(roundTrip.days[0]?.activities[0]?.uploadedImageIds, [12]);

    // Conversely, an omitted coverImageId (undefined) falls back to first uploaded photo
    const omittedPayload: BoardCreatorPayload = {
        ...payload,
        days: [
            {
                ...draft.days[0]!,
                pins: [
                    {
                        ...draft.days[0]!.pins[0]!,
                        coverImageId: undefined
                    }
                ]
            }
        ]
    };
    const omittedWrite = toBoardWrite(omittedPayload, [{ tagId: 3, name: "Food" }]);
    assert.equal(omittedWrite.days[0]?.activities[0]?.coverImageId, 12);
});

test("draft list reads items from data and pagination from meta", async () => {
    const originalFetch = globalThis.fetch;
    const capture = { requestedUrl: "" };
    globalThis.fetch = async (input) => {
        capture.requestedUrl = String(input);
        return Response.json({
            data: [
                {
                    boardId: 4,
                    title: "Draft",
                    updatedAt: "2026-05-01T00:00:00Z"
                }
            ],
            meta: { page: 2, limit: 20, hasMore: true }
        });
    };
    try {
        const result = await listBoardDrafts(2);
        assert.match(capture.requestedUrl, /scope=drafts&page=2$/);
        assert.equal(result.items[0]?.boardId, 4);
        assert.equal(result.hasMore, true);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("My Boards requests the signed-in owner's published list and resolves cover images", async () => {
    const originalFetch = globalThis.fetch;
    const capture: { url?: string; init?: RequestInit } = {};
    globalThis.fetch = async (input, init) => {
        capture.url = String(input);
        capture.init = init;
        return Response.json({
            data: [
                {
                    boardId: 3,
                    title: "My board",
                    status: "published",
                    visibility: "collaborators",
                    coverImageUrl: "/api/v1/images/12/content?variant=thumbnail",
                    updatedAt: "2026-10-13T00:00:00Z"
                }
            ],
            meta: { page: 1, limit: 20, hasMore: false }
        });
    };
    try {
        const result = await listPublishedBoards();
        assert.match(capture.url ?? "", /scope=published&page=1$/);
        assert.equal(capture.init?.credentials, "include");
        assert.equal(result.items[0]?.boardId, 3);
        assert.match(result.items[0]?.coverImageUrl ?? "", /^http:\/\/localhost:3001\/api\/v1\/images\/12/);
        assert.equal(result.hasMore, false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("saving a reopened draft updates the same Board using its revision", async () => {
    const originalFetch = globalThis.fetch;
    const capture: { request?: RequestInit } = {};
    globalThis.fetch = async (_input, init) => {
        capture.request = init;
        return Response.json({ data: { boardId: 8, revision: 6 } });
    };
    try {
        const write = toBoardWrite(draft, [{ tagId: 3, name: "Food" }]);
        await saveBoardDocument(write, {
            boardId: 8,
            revision: 5
        } as BoardDocument);
        assert.equal(capture.request?.method, "PUT");
        assert.equal(capture.request?.credentials, "include");
        assert.equal(JSON.parse(String(capture.request?.body)).revision, 5);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("saved Board can be reopened with stable database IDs and image URLs", () => {
    const write = toBoardWrite(draft, [{ tagId: 3, name: "Food" }]);
    const board: BoardDocument = {
        ...write,
        boardId: 2,
        author: { username: "test_owner", bio: "", photo: null },
        revision: 4,
        permissions: { canEditContent: true, canManageBoard: true },
        coverImageId: 12,
        tags: [{ tagId: 3, name: "Food" }],
        images: [
            {
                imageId: 12,
                url: "/api/v1/images/12/content?variant=display",
                thumbnailUrl: "/api/v1/images/12/content?variant=thumbnail",
                capturedAt: "2026-05-01T10:00:00Z",
                position: 0
            }
        ],
        days: [
            {
                ...write.days[0]!,
                dayId: 7,
                activities: [{ ...write.days[0]!.activities[0]!, activityId: 25 }]
            }
        ],
        createdAt: "2026-05-01T00:00:00Z",
        updatedAt: "2026-05-01T00:00:00Z"
    };
    const restored = fromBoardDocument(board);
    assert.equal(restored.days[0]?.serverDayId, 7);
    assert.equal(restored.days[0]?.pins[0]?.serverActivityId, 25);
    assert.equal(restored.images[0]?.uploadedImageId, 12);
    assert.match(restored.images[0]?.url ?? "", /^http:\/\/localhost:3001\/api\/v1\/images\/12/);
});

test("image upload uses authorization, direct transfer, then completion with cookies only on the API", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (input, init) => {
        calls.push({ url: String(input), init });
        if (calls.length === 1)
            return Response.json({
                data: {
                    uploadId: "upload-1",
                    uploadUrl: "https://api.cloudinary.test/upload",
                    method: "POST",
                    formFields: {
                        public_id: "roamboard/upload-1",
                        signature: "signed"
                    }
                }
            });
        if (calls.length === 2) return Response.json({ public_id: "roamboard/upload-1" });
        return Response.json({
            data: {
                imageId: 12,
                url: "/api/v1/images/12/content?variant=display",
                thumbnailUrl: "/api/v1/images/12/content?variant=thumbnail",
                capturedAt: null,
                latitude: null,
                longitude: null
            }
        });
    };
    try {
        const image = await uploadBoardImage(new File(["photo"], "photo.heic"));
        assert.equal(calls.length, 3);
        assert.match(calls[0]!.url, /\/api\/v1\/images\/upload-intents$/);
        assert.equal(calls[0]!.init?.credentials, "include");
        assert.equal(JSON.parse(String(calls[0]!.init?.body)).contentType, "image/heic");
        assert.equal(calls[1]!.url, "https://api.cloudinary.test/upload");
        assert.equal(calls[1]!.init?.credentials, undefined);
        assert.equal((calls[1]!.init?.body as FormData).get("signature"), "signed");
        assert.match(calls[2]!.url, /\/api\/v1\/images\/complete$/);
        assert.equal(calls[2]!.init?.credentials, "include");
        assert.equal(image.imageId, 12);
        assert.match(image.thumbnailUrl, /^http:\/\/localhost:3001\/api\/v1\/images\/12/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("an HTML API error becomes an actionable message instead of a JSON parse exception", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
        new Response("<!DOCTYPE html>", {
            status: 404,
            headers: { "Content-Type": "text/html" }
        });
    try {
        await assert.rejects(
            uploadBoardImage(new File(["photo"], "photo.jpg", { type: "image/jpeg" })),
            /returned 404 instead of JSON/
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("merging server IDs preserves local edits and newly added pins/images", () => {
    const sentDays = [
        {
            id: "day-local-1",
            serverDayId: undefined,
            dayNumber: 1,
            date: "2026-05-01",
            pins: [
                {
                    id: "pin-local-1",
                    serverActivityId: undefined,
                    order: 0,
                    time: "10:00",
                    title: "Museum",
                    description: "Initial visit",
                    category: "museum" as const,
                    source: "photo" as const,
                    location: null
                }
            ]
        }
    ];

    const savedBoard: BoardDocument = {
        boardId: 42,
        author: { username: "test_owner", bio: "", photo: null },
        revision: 2,
        status: "draft",
        title: "Test",
        description: null,
        visibility: "collaborators",
        coverImageId: null,
        tagIds: [],
        tags: [],
        imageIds: [100],
        images: [
            {
                imageId: 100,
                url: "/api/v1/images/100/content?variant=display",
                thumbnailUrl: "/api/v1/images/100/content?variant=thumbnail",
                capturedAt: null,
                position: 0
            }
        ],
        days: [
            {
                dayId: 555,
                dayNumber: 1,
                date: "2026-05-01",
                activities: [
                    {
                        activityId: 777,
                        position: 0,
                        activityTime: "10:00",
                        title: "Museum",
                        note: "Initial visit",
                        category: "museum",
                        source: "photo",
                        location: null,
                        locationConfirmed: false,
                        uploadedImageIds: [],
                        coverImageId: null,
                        externalImage: null
                    }
                ]
            }
        ],
        permissions: { canEditContent: true, canManageBoard: true },
        createdAt: "2026-05-01T00:00:00Z",
        updatedAt: "2026-05-01T00:00:00Z"
    };

    const currentDays = [
        {
            ...sentDays[0]!,
            pins: [
                {
                    ...sentDays[0]!.pins[0]!,
                    title: "Museum (Updated locally)",
                    description: "Updated description"
                },
                {
                    id: "pin-local-2",
                    serverActivityId: undefined,
                    order: 1,
                    time: "14:00",
                    title: "New Pin Added During Save",
                    description: "Fresh pin",
                    category: "cafe" as const,
                    source: "manual" as const,
                    location: null
                }
            ]
        }
    ];

    const mergedDays = mergeServerIds(currentDays, sentDays, savedBoard);

    assert.equal(mergedDays[0]?.serverDayId, 555);
    assert.equal(mergedDays[0]?.id, "day-local-1");
    assert.equal(mergedDays[0]?.pins[0]?.serverActivityId, 777);
    assert.equal(mergedDays[0]?.pins[0]?.id, "pin-local-1");
    assert.equal(mergedDays[0]?.pins[0]?.title, "Museum (Updated locally)");
    assert.equal(mergedDays[0]?.pins[0]?.description, "Updated description");
    assert.equal(mergedDays[0]?.pins[1]?.id, "pin-local-2");
    assert.equal(mergedDays[0]?.pins[1]?.serverActivityId, undefined);
    assert.equal(mergedDays[0]?.pins[1]?.title, "New Pin Added During Save");

    const currentImages = [
        {
            id: "img-1",
            uploadedImageId: 100,
            pinId: null,
            publicId: "100",
            source: "upload" as const,
            url: "blob://local",
            thumbnailUrl: "blob://local-thumb",
            width: 0,
            height: 0,
            capturedAt: null,
            latitude: null,
            longitude: null,
            order: 0,
            credit: null,
            creditUrl: null,
            sourceUrl: null
        },
        {
            id: "img-2",
            uploadedImageId: 200,
            pinId: null,
            publicId: "200",
            source: "upload" as const,
            url: "blob://pending-upload",
            thumbnailUrl: "blob://pending-upload-thumb",
            width: 0,
            height: 0,
            capturedAt: null,
            latitude: null,
            longitude: null,
            order: 1,
            credit: null,
            creditUrl: null,
            sourceUrl: null
        }
    ];

    const mergedImages = mergeServerImages(currentImages, savedBoard);
    assert.equal(mergedImages.length, 2);
    assert.match(mergedImages[0]?.url ?? "", /^http:\/\/localhost:3001\/api\/v1\/images\/100/);
    assert.equal(mergedImages[1]?.uploadedImageId, 200);
    assert.equal(mergedImages[1]?.url, "blob://pending-upload");
});
