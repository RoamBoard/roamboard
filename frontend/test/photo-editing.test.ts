import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BoardImageIntake from "../src/components/features/boards/BoardImageIntake";
import type { BoardImageDraft } from "../src/types/board-creator";
import { cropAspect, fullCrop, outputSize } from "../src/lib/photo-editing";

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
    assert.match(markup, /1 photo is not linked to an activity/);
    assert.match(markup, /Linked to an activity/);
    assert.match(markup, /Not linked to an activity/);
    assert.equal((markup.match(/Crop \/ resize/g) ?? []).length, 2);
    assert.doesNotMatch(markup, /Add activity photos in Smart Create below/);
});
test("a constrained aspect crop does not shrink below the saved crop limits", () => {
    const crop = cropAspect({ x: 0.9, y: 0.9, width: 0.01, height: 0.01 }, 3 / 2, 9 / 16);
    assert.ok(crop.width >= 0.01 && crop.height >= 0.01);
    assert.ok(crop.x + crop.width <= 1 && crop.y + crop.height <= 1);
});
