import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BoardImageIntake from "../src/components/features/boards/BoardImageIntake";
import type { BoardImageDraft } from "../src/types/board-creator";
import { cropAspect, fullCrop, outputSize, readOriginalPhoto } from "../src/lib/photo-editing";

test("original photo reads request the protected original with cookies and a cancellation signal", async (context) => {
    const controller = new AbortController();
    const bytes = new Uint8Array([137, 80, 78, 71]);
    context.mock.method(globalThis, "fetch", async (input: string, init?: RequestInit) => {
        const url = new URL(input);
        assert.equal(url.pathname, "/api/v1/images/42/content");
        assert.equal(url.searchParams.get("variant"), "original");
        assert.equal(init?.credentials, "include");
        assert.equal(init?.signal, controller.signal);
        return new Response(bytes, { headers: { "Content-Type": "image/png" } });
    });
    const blob = await readOriginalPhoto(42, controller.signal);
    assert.equal(blob.type, "image/png");
    assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
});

test("failed original photo reads report a safe error instead of returning an error body as an image", async (context) => {
    context.mock.method(globalThis, "fetch", async () => new Response("Forbidden", { status: 403 }));
    await assert.rejects(readOriginalPhoto(42), { message: "The original photo could not load." });
});

test("original photo reads preserve fetch cancellation", async (context) => {
    const controller = new AbortController();
    controller.abort();
    context.mock.method(globalThis, "fetch", async (_input: string, init?: RequestInit) => {
        init?.signal?.throwIfAborted();
        throw new Error("Expected an aborted request");
    });
    await assert.rejects(readOriginalPhoto(42, controller.signal), { name: "AbortError" });
});

test("aspect-ratio crops stay inside original bounds for landscape and portrait photos", () => {
    for (const source of [4 / 3, 3 / 4, 16 / 9])
        for (const ratio of [1, 16 / 9, 9 / 16]) {
            const crop = cropAspect(fullCrop, source, ratio);
            assert.ok(
                crop.x >= 0 && crop.y >= 0 && crop.x + crop.width <= 1.000001 && crop.y + crop.height <= 1.000001
            );
            assert.ok(Math.abs((crop.width * source) / crop.height - ratio) < 0.00001);
            const output = outputSize(1600, ratio);
            assert.ok(Math.abs(output.outputWidth / output.outputHeight - ratio) < 0.01);
        }
});

test("uploads distinguish unassigned photos from activity photos and keep cropping available", () => {
    const photo: BoardImageDraft = {
        id: "one",
        uploadedImageId: 1,
        pinId: null,
        publicId: "1",
        source: "upload",
        url: "https://example.test/1.jpg",
        thumbnailUrl: "https://example.test/1.jpg",
        width: 1000,
        height: 800,
        capturedAt: null,
        latitude: null,
        longitude: null,
        order: 0,
        credit: null,
        creditUrl: null,
        sourceUrl: null
    };
    const markup = renderToStaticMarkup(
        createElement(BoardImageIntake, {
            images: [
                photo,
                { ...photo, id: "two", uploadedImageId: 2, pinId: "activity" },
                { ...photo, id: "stock", uploadedImageId: undefined, source: "unsplash", pinId: "activity" }
            ],
            coverImageId: 1,
            onSelectCover() {},
            onUploaded() {},
            onRemove() {}
        })
    );
    assert.match(markup, /aria-label="Available to attach"/);
    assert.match(markup, /Linked to an activity/);
    assert.match(markup, /aria-label="Linked to an activity"/);
    assert.equal((markup.match(/aria-label="Crop photo \d+"/g) ?? []).length, 2);
    assert.doesNotMatch(markup, /Add activity photos in Smart Create below/);
});
test("a constrained aspect crop does not shrink below the saved crop limits", () => {
    const crop = cropAspect({ x: 0.9, y: 0.9, width: 0.01, height: 0.01 }, 3 / 2, 9 / 16);
    assert.ok(crop.width >= 0.01 && crop.height >= 0.01);
    assert.ok(crop.x + crop.width <= 1 && crop.y + crop.height <= 1);
});
