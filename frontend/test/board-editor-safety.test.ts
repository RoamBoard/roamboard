import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import CreatorProgress from "../src/components/features/boards/CreatorProgress";
import { boardEditorFingerprint, shouldConfirmBoardNavigation } from "../src/lib/board-editor-safety";
import { uploadBoardImageBatch } from "../src/lib/board-image-upload";
import { fromBoardDocument, toBoardWrite, type BoardDocument } from "../src/lib/board-creator-api";
import type { BoardCreatorPayload, BoardImageDraft, BoardPinDraft } from "../src/types/board-creator";

function image(id: number, pinId: string | null, activityOrder: number): BoardImageDraft {
    return {
        id: `local-image-${id}`,
        uploadedImageId: id,
        pinId,
        publicId: String(id),
        source: "upload",
        url: `/protected/${id}?version=1`,
        thumbnailUrl: `/protected/${id}?thumbnail=1`,
        width: 1200,
        height: 800,
        capturedAt: "2026-06-04T09:00:00Z",
        latitude: 59.32,
        longitude: 18.06,
        order: id - 101,
        activityOrder,
        credit: null,
        creditUrl: null,
        sourceUrl: null
    };
}

function pin(id: string, source: BoardPinDraft["source"]): BoardPinDraft {
    return {
        id,
        serverActivityId: 31,
        coverImageId: 102,
        order: 0,
        time: "09:00",
        title: `Visit ${id}`,
        description: "Museum notes",
        category: "museum",
        source,
        location: {
            name: "Museum",
            address: "Museum street",
            city: "Stockholm",
            country: "Sweden",
            countryCode: "SWE",
            latitude: 59.32,
            longitude: 18.06,
            mapboxId: "provider-place-1"
        }
    };
}

function board(): BoardCreatorPayload {
    return {
        title: "Museum journey",
        description: "A gallery day",
        status: "draft",
        visibility: "friends",
        coverImageId: 102,
        tags: ["Museums", "Coffee"],
        images: [
            image(101, "photo-pin", 1),
            image(102, "photo-pin", 0),
            image(103, "manual-pin", 0),
            {
                ...image(104, "external-pin", 0),
                uploadedImageId: undefined,
                source: "unsplash",
                publicId: "external-photo",
                url: "https://photos.example.test/original",
                thumbnailUrl: "https://photos.example.test/thumb",
                credit: "Photographer",
                creditUrl: "https://photos.example.test/photographer",
                sourceUrl: "https://photos.example.test/source"
            }
        ],
        days: [
            {
                id: "local-day-one",
                serverDayId: 11,
                dayNumber: 1,
                date: "2026-06-04",
                pins: [
                    pin("photo-pin", "photo"),
                    { ...pin("manual-pin", "manual"), serverActivityId: 32, coverImageId: 103, order: 1 }
                ]
            },
            {
                id: "local-day-two",
                serverDayId: 12,
                dayNumber: 2,
                date: null,
                pins: [{ ...pin("external-pin", "geoapify"), serverActivityId: 33, coverImageId: null }]
            }
        ]
    };
}

function freeze<T>(value: T): T {
    if (value !== null && typeof value === "object") {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}

test("fingerprints ignore remapped local/server identifiers while retaining photo assignments and confirmations", () => {
    const source = freeze(board());
    const before = structuredClone(source);
    const reloaded = structuredClone(source);
    reloaded.days.forEach((day, dayIndex) => {
        day.id = `new-day-${dayIndex}`;
        day.serverDayId = 200 + dayIndex;
        day.pins.forEach((activity, pinIndex) => {
            const oldId = activity.id;
            activity.id = `new-pin-${dayIndex}-${pinIndex}`;
            activity.serverActivityId = 300 + dayIndex * 10 + pinIndex;
            reloaded.images
                .filter((photo) => photo.pinId === oldId)
                .forEach((photo) => {
                    photo.pinId = activity.id;
                    photo.id = `new-${photo.id}`;
                });
        });
    });
    assert.equal(
        boardEditorFingerprint(source, new Set(["photo-pin"])),
        boardEditorFingerprint(reloaded, new Set(["new-pin-0-0"]))
    );
    assert.deepEqual(source, before);
});

test("upload URL refreshes and derived metadata do not invent unsaved edits", () => {
    const source = board();
    const refreshed = structuredClone(source);
    refreshed.status = "published";
    refreshed.images
        .filter((photo) => photo.source === "upload")
        .forEach((photo) => {
            photo.url = `https://api.example.test/new/${photo.uploadedImageId}?signature=rotated`;
            photo.thumbnailUrl = `${photo.url}&thumbnail=1`;
            photo.width = 2000;
            photo.height = 1500;
            photo.capturedAt = null;
            photo.latitude = null;
            photo.longitude = null;
        });
    refreshed.days[0].pins[0].location!.countryCode = null;
    assert.equal(boardEditorFingerprint(source, new Set()), boardEditorFingerprint(refreshed, new Set()));
});

test("equivalent tag membership, trimmed notes and manual confirmation bookkeeping stay clean", () => {
    const source = board();
    const equivalent = structuredClone(source);
    equivalent.tags.reverse();
    equivalent.description = `  ${source.description}  `;
    equivalent.days[0].pins[0].description = `  ${source.days[0].pins[0].description}  `;
    assert.equal(
        boardEditorFingerprint(source, new Set(["photo-pin"])),
        boardEditorFingerprint(equivalent, new Set(["manual-pin", "photo-pin", "missing-local-pin"]))
    );
});

test("every meaningful content, cover, assignment and ordering edit changes the persisted fingerprint", () => {
    const source = board();
    const baseline = boardEditorFingerprint(source, new Set(["photo-pin"]));
    const changes: Array<[string, (value: BoardCreatorPayload) => void]> = [
        [
            "Board title",
            (value) => {
                value.title = "Another journey";
            }
        ],
        [
            "Board description",
            (value) => {
                value.description = "Changed notes";
            }
        ],
        [
            "visibility",
            (value) => {
                value.visibility = "public";
            }
        ],
        [
            "tag membership",
            (value) => {
                value.tags = ["Museums", "Nature"];
            }
        ],
        [
            "Board cover",
            (value) => {
                value.coverImageId = 101;
            }
        ],
        [
            "day date",
            (value) => {
                value.days[0].date = "2026-06-05";
            }
        ],
        [
            "day addition",
            (value) => {
                value.days.push({ id: "day-three", dayNumber: 3, date: null, pins: [] });
            }
        ],
        [
            "day ordering",
            (value) => {
                value.days.reverse().forEach((day, index) => {
                    day.dayNumber = index + 1;
                });
            }
        ],
        [
            "activity title",
            (value) => {
                value.days[0].pins[0].title = "New activity title";
            }
        ],
        [
            "activity notes",
            (value) => {
                value.days[0].pins[0].description = "New activity notes";
            }
        ],
        [
            "activity time",
            (value) => {
                value.days[0].pins[0].time = "14:30";
            }
        ],
        [
            "activity category",
            (value) => {
                value.days[0].pins[0].category = "cafe";
            }
        ],
        [
            "activity ordering",
            (value) => {
                value.days[0].pins.reverse();
            }
        ],
        [
            "activity cover",
            (value) => {
                value.days[0].pins[0].coverImageId = 101;
            }
        ],
        [
            "activity source",
            (value) => {
                value.days[0].pins[0].source = "manual";
            }
        ],
        [
            "location",
            (value) => {
                value.days[0].pins[0].location!.latitude = 60;
            }
        ],
        [
            "location removal",
            (value) => {
                value.days[0].pins[0].location = null;
            }
        ],
        [
            "photo assignment",
            (value) => {
                value.images[0].pinId = "manual-pin";
            }
        ],
        [
            "activity photo order",
            (value) => {
                value.images[0].activityOrder = -1;
            }
        ],
        [
            "Board photo order",
            (value) => {
                value.images.reverse();
            }
        ],
        [
            "photo removal",
            (value) => {
                value.images.splice(0, 1);
            }
        ],
        [
            "external attribution",
            (value) => {
                value.images[3].credit = "Another photographer";
            }
        ],
        [
            "external photo URL",
            (value) => {
                value.images[3].url = "https://photos.example.test/another-photo";
            }
        ]
    ];
    for (const [label, change] of changes) {
        const edited = structuredClone(source);
        change(edited);
        assert.notEqual(
            boardEditorFingerprint(edited, new Set(["photo-pin"])),
            baseline,
            `${label} must be protected as unsaved content`
        );
    }
});

test("confirming a photo location changes dirty meaning and confirmation-set order does not", () => {
    const source = board();
    assert.notEqual(boardEditorFingerprint(source, new Set()), boardEditorFingerprint(source, new Set(["photo-pin"])));
    assert.equal(
        boardEditorFingerprint(source, new Set(["manual-pin", "photo-pin"])),
        boardEditorFingerprint(source, new Set(["photo-pin", "manual-pin"]))
    );
});

test("canonical save-and-reopen mapping preserves the content fingerprint despite fresh local IDs and URLs", () => {
    const source = board();
    const tags = source.tags.map((name, index) => ({ name, tagId: index + 1 }));
    const write = toBoardWrite(source, tags, new Set(["photo-pin"]));
    const saved: BoardDocument = {
        author: { username: "test-author", bio: "", photo: null },
        ...write,
        boardId: 40,
        revision: 2,
        tags,
        permissions: { canEditContent: true, canManageBoard: true },
        images: source.images
            .filter((photo) => photo.source === "upload")
            .map((photo, position) => ({
                imageId: photo.uploadedImageId!,
                position,
                url: `/api/v1/images/${photo.uploadedImageId}/content?version=2`,
                thumbnailUrl: `/api/v1/images/${photo.uploadedImageId}/content?variant=thumbnail`,
                capturedAt: photo.capturedAt
            })),
        days: write.days.map((day, index) => ({
            ...day,
            dayId: day.dayId ?? index + 1,
            activities: day.activities.map((activity, position) => ({
                ...activity,
                activityId: activity.activityId ?? position + 1
            }))
        })),
        createdAt: "2026-06-01T00:00:00Z",
        updatedAt: "2026-06-02T00:00:00Z"
    };
    const restored = fromBoardDocument(saved);
    const reopened: BoardCreatorPayload = {
        ...source,
        title: saved.title,
        description: saved.description ?? "",
        visibility: saved.visibility,
        coverImageId: saved.coverImageId,
        ...restored
    };
    assert.equal(
        boardEditorFingerprint(source, new Set(["photo-pin"])),
        boardEditorFingerprint(reopened, restored.confirmedPhotoPins)
    );
});

const currentURL = "https://roamboard.example.test/boards/new?mode=scratch#board-title";
const click = { button: 0, defaultPrevented: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
const link = { href: "/boards/drafts", target: "", download: false };

test("normal same-window editor departures prompt for path or query changes", () => {
    for (const href of [
        "/boards/drafts",
        "/create",
        "?mode=smart",
        "/boards/new",
        "../drafts",
        "/boards/new?mode=scratch&extra=1"
    ]) {
        assert.equal(shouldConfirmBoardNavigation(click, { ...link, href }, currentURL), true, href);
    }
    assert.equal(shouldConfirmBoardNavigation(click, { ...link, target: "_SELF" }, currentURL), true);
});

test("current-document hash links and identical URLs do not interrupt editing", () => {
    for (const href of ["#day-plan", "", currentURL, "/boards/new?mode=scratch#board-preview"]) {
        assert.equal(shouldConfirmBoardNavigation(click, { ...link, href }, currentURL), false, href);
    }
});

test("modified, canceled and nonprimary clicks never trigger the captured-link confirmation", () => {
    for (const event of [
        { button: 1 },
        { button: 2 },
        { defaultPrevented: true },
        { metaKey: true },
        { ctrlKey: true },
        { shiftKey: true },
        { altKey: true }
    ]) {
        assert.equal(shouldConfirmBoardNavigation({ ...click, ...event }, link, currentURL), false);
    }
});

test("new windows, downloads and external document departures avoid a duplicate link prompt", () => {
    for (const anchor of [
        { target: "_blank" },
        { target: "other-window" },
        { download: true },
        { href: "https://another.example.test/create" },
        { href: "http://roamboard.example.test/create" },
        { href: "mailto:person@example.test" },
        { href: "tel:+4612345678" }
    ]) {
        assert.equal(shouldConfirmBoardNavigation(click, { ...link, ...anchor }, currentURL), false);
    }
});

test("editor progress never labels modified or pending content as saved and keeps same-page chapter links available", () => {
    const base = { dirty: false, saved: false, loading: false, saving: null, uploading: false };
    const states = [
        { props: base, expected: /Not saved yet/ },
        { props: { ...base, saved: true }, expected: /All changes saved/ },
        { props: { ...base, saved: true, dirty: true }, expected: /Unsaved changes/ },
        { props: { ...base, saved: true, dirty: true, uploading: true }, expected: /Uploading images/ },
        { props: { ...base, saved: true, dirty: true, saving: "draft" as const }, expected: /Saving/ },
        { props: { ...base, loading: true }, expected: /Loading Board/ }
    ];
    for (const { props, expected } of states) {
        const markup = renderToStaticMarkup(createElement(CreatorProgress, props));
        assert.match(markup, expected);
        if (props.dirty || props.uploading || props.saving || props.loading)
            assert.doesNotMatch(markup, /All changes saved/);
        for (const href of ["#board-basics", "#day-plan", "#details-discovery", "#board-preview", "#publish"])
            assert.ok(markup.includes(`href="${href}"`));
    }
});

function deferred<T>() {
    const state: { resolve?: (value: T) => void } = {};
    const promise = new Promise<T>((resolve) => {
        state.resolve = resolve;
    });
    return {
        promise,
        resolve(value: T) {
            assert.ok(state.resolve);
            state.resolve(value);
        }
    };
}

test("a partial photo batch retains successful uploads in input order through real intent/storage/completion helpers", async (t) => {
    const firstCompletion = deferred<Response>();
    const firstStarted = deferred<void>();
    const requests: Array<{ path: string; stage: string; file: string }> = [];
    t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
        const url = new URL(input);
        if (url.pathname === "/api/v1/images/upload-intents") {
            assert.equal(init.credentials, "include");
            assert.equal(init.method, "POST");
            const body = JSON.parse(String(init.body)) as { fileName: string; contentType: string; sizeBytes: number };
            assert.equal(body.contentType, "image/jpeg");
            assert.ok(body.sizeBytes > 0);
            requests.push({ path: url.pathname, stage: "intent", file: body.fileName });
            if (body.fileName === "intent-denied.jpg")
                return Response.json({ error: { message: "Photo upload is not permitted." } }, { status: 403 });
            return Response.json({
                data: {
                    uploadId: body.fileName,
                    uploadUrl: `https://storage.example.test/${body.fileName}`,
                    method: "POST",
                    formFields: { key: `reserved/${body.fileName}` }
                }
            });
        }
        if (url.origin === "https://storage.example.test") {
            assert.equal(init.credentials, undefined);
            assert.equal(init.method, "POST");
            assert.ok(init.body instanceof FormData);
            const file = init.body.get("file");
            assert.ok(file instanceof File);
            assert.equal(init.body.get("key"), `reserved/${file.name}`);
            requests.push({ path: url.pathname, stage: "storage", file: file.name });
            return new Response(null, { status: file.name === "storage-denied.jpg" ? 503 : 204 });
        }
        assert.equal(url.pathname, "/api/v1/images/complete");
        assert.equal(init.credentials, "include");
        const { uploadId } = JSON.parse(String(init.body)) as { uploadId: string };
        requests.push({ path: url.pathname, stage: "complete", file: uploadId });
        if (uploadId === "completion-denied.jpg")
            return Response.json({ error: { message: "Photo processing failed." } }, { status: 422 });
        if (uploadId === "first.jpg") {
            firstStarted.resolve();
            return firstCompletion.promise;
        }
        return Response.json({
            data: {
                imageId: 505,
                url: "/images/505/content",
                thumbnailUrl: "/images/505/thumbnail",
                capturedAt: null,
                latitude: null,
                longitude: null
            }
        });
    });
    const files = ["first.jpg", "intent-denied.jpg", "storage-denied.jpg", "completion-denied.jpg", "last.jpg"].map(
        (name) => new File(["photo bytes"], name, { type: "image/jpeg" })
    );
    const pending = uploadBoardImageBatch(files);
    await firstStarted.promise;
    firstCompletion.resolve(
        Response.json({
            data: {
                imageId: 501,
                url: "/images/501/content",
                thumbnailUrl: "/images/501/thumbnail",
                capturedAt: "2026-06-04T09:00:00Z",
                latitude: 59.32,
                longitude: 18.06
            }
        })
    );
    const result = await pending;
    assert.deepEqual(
        result.assets.map((asset) => asset.imageId),
        [501, 505]
    );
    assert.equal(result.assets[0].capturedAt, "2026-06-04T09:00:00Z");
    assert.equal(result.assets[0].latitude, 59.32);
    assert.match(result.assets[0].url, /^https?:\/\/[^/]+\/images\/501\/content$/);
    assert.equal(result.failures.length, 3);
    assert.ok(result.failures.some((message) => message.includes("not permitted")));
    assert.ok(result.failures.some((message) => message.includes("503")));
    assert.ok(result.failures.some((message) => message.includes("processing failed")));
    assert.equal(requests.filter((request) => request.stage === "intent").length, 5);
    assert.equal(requests.filter((request) => request.stage === "storage").length, 4);
    assert.equal(requests.filter((request) => request.stage === "complete").length, 3);
    assert.ok(!requests.some((request) => request.file === "intent-denied.jpg" && request.stage !== "intent"));
    assert.ok(!requests.some((request) => request.file === "storage-denied.jpg" && request.stage === "complete"));
});

test("an empty or entirely failed upload batch returns no fabricated successful images", async (t) => {
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string) => {
        requests.push(input);
        return Response.json({ error: { message: "Upload service unavailable." } }, { status: 503 });
    });
    assert.deepEqual(await uploadBoardImageBatch([]), { assets: [], failures: [] });
    assert.equal(requests.length, 0);
    const result = await uploadBoardImageBatch([
        new File(["photo bytes"], "one.jpg", { type: "image/jpeg" }),
        new File(["photo bytes"], "two.jpg", { type: "image/jpeg" })
    ]);
    assert.deepEqual(result.assets, []);
    assert.equal(result.failures.length, 2);
    assert.ok(result.failures.every((message) => message.includes("Upload service unavailable")));
    assert.equal(requests.length, 2);
});
