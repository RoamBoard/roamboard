import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CroppedPhoto from "../src/components/images/CroppedPhoto";
import {
    fromBoardDocument,
    saveBoardDocument,
    toBoardWrite,
    type ActivityPhotoWrite,
    type BoardDocument
} from "../src/lib/board-creator-api";
import type { BoardCreatorPayload } from "../src/types/board-creator";

const crop = { x: 0.1, y: 0.2, width: 0.7, height: 0.6, outputWidth: 800, outputHeight: 600 };

test("external crop clips the canonical provider image locally and retains Unsplash attribution parameters", () => {
    const html = renderToStaticMarkup(
        createElement(CroppedPhoto, {
            src: "https://images.unsplash.com/photo-original?ixid=required-credit&auto=format",
            alt: "Original photo",
            width: 1600,
            height: 2400,
            presentation: { x: 0.25, y: 0.125, width: 0.5, height: 0.5, outputWidth: 800, outputHeight: 600 }
        })
    );
    const source = /<img[^>]*src="([^"]+)"/.exec(html)?.[1];
    assert.ok(source);
    const url = new URL(source.replaceAll("&amp;", "&"));
    assert.equal(url.origin, "https://images.unsplash.com");
    assert.equal(url.pathname, "/photo-original");
    assert.equal(url.searchParams.get("ixid"), "required-credit");
    assert.equal(url.searchParams.get("auto"), "format");
    assert.equal(url.searchParams.get("fit"), "max");
    assert.equal(url.searchParams.get("w"), "1600");
    assert.equal(url.searchParams.get("h"), "1200");
    assert.match(html, /overflow-hidden/);
    assert.match(html, /width:200%;height:200%;left:-50%;top:-25%/);
    assert.doesNotMatch(html, /data:image|blob:|cloudinary|crop_rect|rect=/);
});

test("cropped thumbnails bound delivery to 640 pixels without changing saved crop or attribution", () => {
    const presentation = { x: 0.2, y: 0.125, width: 0.6, height: 0.5, outputWidth: 4096, outputHeight: 4096 };
    const before = structuredClone(presentation);
    const render = (thumbnail: boolean) =>
        renderToStaticMarkup(
            createElement(CroppedPhoto, {
                src: "https://images.unsplash.com/photo-original?ixid=retained-credit&auto=format",
                alt: "Original",
                width: 1600,
                height: 1200,
                presentation,
                thumbnail
            })
        );
    const source = (html: string) => {
        const match = /<img[^>]*src="([^"]+)"/.exec(html)?.[1];
        assert.ok(match);
        return new URL(match.replaceAll("&amp;", "&"));
    };
    const thumbnail = source(render(true));
    const large = source(render(false));
    assert.equal(thumbnail.searchParams.get("w"), "640");
    assert.equal(thumbnail.searchParams.get("h"), "640");
    assert.equal(large.searchParams.get("w"), "4096");
    assert.equal(large.searchParams.get("h"), "4096");
    assert.equal(thumbnail.searchParams.get("ixid"), "retained-credit");
    assert.equal(thumbnail.searchParams.get("auto"), "format");
    assert.deepEqual(presentation, before);
    assert.match(render(true), /left:-33\.333333333333336%;top:-25%/);
});
function external(providerImageId: string): Extract<ActivityPhotoWrite, { source: "unsplash" }> {
    return {
        source: "unsplash",
        providerImageId,
        url: `https://images.unsplash.com/${providerImageId}?ixid=credit`,
        thumbnailUrl: `https://images.unsplash.com/${providerImageId}?ixid=credit&w=400`,
        alt: "Photo selected by me",
        photographer: "Photographer",
        photographerUrl: "https://unsplash.com/@photographer",
        sourceUrl: `https://unsplash.com/photos/${providerImageId}`,
        width: 1600,
        height: 2400,
        context: null,
        presentation: crop
    };
}
function document(): BoardDocument {
    const first = external("first");
    return {
        boardId: 42,
        revision: 3,
        status: "draft",
        title: "Our weekend",
        description: null,
        visibility: "friends",
        tagIds: [],
        imageIds: [10, 20, 30],
        coverImageId: 10,
        author: { username: "owner", bio: "", photo: null },
        permissions: { canEditContent: true, canManageBoard: true },
        tags: [],
        images: [10, 20, 30].map((imageId, position) => ({
            imageId,
            position,
            url: `/images/${imageId}`,
            thumbnailUrl: `/images/${imageId}/thumb`,
            capturedAt: null
        })),
        days: [
            {
                dayId: 1,
                dayNumber: 1,
                date: null,
                color: "#b87568",
                activities: [
                    {
                        activityId: 7,
                        position: 0,
                        title: "Afternoon",
                        note: null,
                        category: "museum",
                        source: "manual",
                        activityTime: "14:35",
                        location: null,
                        locationConfirmed: false,
                        uploadedImageIds: [20, 10],
                        coverImageId: null,
                        externalImage: {
                            provider: "unsplash",
                            providerImageId: "first",
                            url: first.url,
                            photographer: "Photographer",
                            photographerUrl: "https://unsplash.com/@photographer",
                            sourceUrl: "https://unsplash.com/photos/first",
                            context: null
                        },
                        photos: [
                            first,
                            { source: "upload", imageId: 20 },
                            external("second"),
                            { source: "upload", imageId: 10 }
                        ],
                        coverPhoto: { source: "unsplash", providerImageId: "second" }
                    }
                ]
            }
        ],
        createdAt: "2026-10-25T12:00:00Z",
        updatedAt: "2026-10-25T12:00:00Z"
    };
}
function payload(board: BoardDocument): BoardCreatorPayload {
    return {
        ...fromBoardDocument(board),
        title: board.title,
        description: board.description ?? "",
        status: board.status,
        visibility: board.visibility,
        tags: [],
        coverImageId: board.coverImageId
    };
}

test("reopening mixed activity media retains interleaved order, chosen external cover and crop through the actual save request", async (context) => {
    const board = document();
    const draft = payload(board);
    const pin = draft.days[0].pins[0];
    assert.deepEqual(pin.coverPhoto, { source: "unsplash", providerImageId: "second" });
    const attached = draft.images
        .filter((image) => image.pinId === pin.id)
        .sort((a, b) => (a.activityOrder ?? a.order) - (b.activityOrder ?? b.order));
    assert.deepEqual(
        attached.map((image) => (image.source === "upload" ? image.uploadedImageId : image.publicId)),
        ["first", 20, "second", 10]
    );
    assert.equal(draft.images.find((image) => image.uploadedImageId === 30)?.pinId, null);
    const requests: Array<{
        url: string;
        init: RequestInit;
        body: { revision: number; days: Array<{ activities: Array<Record<string, unknown>> }> };
    }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        assert.ok(init);
        requests.push({ url: String(input), init, body: JSON.parse(String(init.body)) });
        return Response.json({ data: { ...board, revision: 4 } });
    });
    const saved = await saveBoardDocument(toBoardWrite(draft, []), board);
    assert.equal(saved.revision, 4);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].init.method, "PUT");
    assert.equal(requests[0].init.credentials, "include");
    assert.equal(requests[0].body.revision, 3);
    const activity = requests[0].body.days[0].activities[0];
    assert.deepEqual(activity.photos, board.days[0].activities[0].photos);
    assert.deepEqual(activity.coverPhoto, board.days[0].activities[0].coverPhoto);
    for (const legacy of ["uploadedImageIds", "externalImage", "coverImageId"])
        assert.equal(legacy in activity, false, `Network writes must not mix ${legacy} with canonical photos`);
});

test("the same Unsplash identity keeps independent per-activity presentation rather than sharing a mutable crop", () => {
    const board = document();
    const initial = board.days[0].activities[0];
    board.days[0].activities.push({
        ...initial,
        activityId: 8,
        position: 1,
        title: "Evening",
        photos: [external("first")],
        uploadedImageIds: [],
        coverPhoto: { source: "unsplash", providerImageId: "first" }
    });
    const draft = payload(board);
    const [first, second] = draft.days[0].pins;
    const changed = { ...crop, x: 0.2, width: 0.6 };
    draft.images = draft.images.map((image) =>
        image.pinId === first.id && image.publicId === "first" ? { ...image, presentation: changed } : image
    );
    const write = toBoardWrite(draft, []);
    const firstPhoto = write.days[0].activities[0].photos?.[0];
    const secondPhoto = write.days[0].activities[1].photos?.[0];
    assert.ok(firstPhoto?.source === "unsplash" && secondPhoto?.source === "unsplash");
    assert.deepEqual(firstPhoto.presentation, changed);
    assert.deepEqual(secondPhoto.presentation, crop);
    assert.equal(draft.images.filter((image) => image.pinId === second.id).length, 1);
    assert.deepEqual(
        board.days[0].activities[0].photos?.[0],
        external("first"),
        "Editing a draft must not mutate its saved source"
    );
});
