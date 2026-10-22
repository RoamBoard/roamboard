import assert from "node:assert/strict";
import test from "node:test";

import {
    createBoardSchema,
    imageVariantQuerySchema,
    replaceBoardSchema
} from "../src/features/boards/boards.schemas.js";

const draft = {
    status: "draft",
    title: "A quiet weekend",
    description: null,
    visibility: "public",
    tagIds: [],
    imageIds: [],
    days: []
};

test("story illustration opt-in defaults off on create and leaves omitted replacement preferences unspecified", () => {
    assert.equal(createBoardSchema.parse(draft).fillerImagesEnabled, false);
    assert.equal(replaceBoardSchema.parse({ ...draft, revision: 4 }).fillerImagesEnabled, undefined);
    for (const fillerImagesEnabled of [true, false]) {
        assert.equal(
            createBoardSchema.parse({ ...draft, fillerImagesEnabled }).fillerImagesEnabled,
            fillerImagesEnabled
        );
        assert.equal(
            replaceBoardSchema.parse({ ...draft, revision: 4, fillerImagesEnabled }).fillerImagesEnabled,
            fillerImagesEnabled
        );
    }
});

test("story writes reject null and coercible preferences, and never accept server-owned illustration/count fields", () => {
    for (const value of [null, 0, 1, "true", "false", [], {}]) {
        assert.equal(createBoardSchema.safeParse({ ...draft, fillerImagesEnabled: value }).success, false);
        assert.equal(
            replaceBoardSchema.safeParse({ ...draft, revision: 4, fillerImagesEnabled: value }).success,
            false
        );
    }
    for (const extra of [{ fillerImages: [] }, { fillerImageStatus: "ready" }, { commentCount: 0 }]) {
        assert.equal(createBoardSchema.safeParse({ ...draft, ...extra }).success, false);
        assert.equal(replaceBoardSchema.safeParse({ ...draft, revision: 4, ...extra }).success, false);
    }
});

test("the frontend note limit does not shrink the canonical backend 500-character allowance", () => {
    const withNote = (note: string) => ({
        ...draft,
        days: [
            {
                dayNumber: 1,
                date: null,
                activities: [
                    {
                        position: 0,
                        title: "Walk",
                        activityTime: null,
                        category: "other",
                        note,
                        source: "manual",
                        location: null,
                        locationConfirmed: false,
                        uploadedImageIds: [],
                        externalImage: null
                    }
                ]
            }
        ]
    });
    const legacy = "x".repeat(500);
    assert.equal(createBoardSchema.parse(withNote(legacy)).days[0]?.activities[0]?.note, legacy);
    assert.equal(createBoardSchema.safeParse(withNote("x".repeat(501))).success, false);
});

test("large delivery is an explicit validated variant and retains exclusive Board/profile context", () => {
    assert.equal(imageVariantQuerySchema.parse({ variant: "large", boardId: "42", v: "3" }).variant, "large");
    assert.equal(
        imageVariantQuerySchema.parse({ variant: "large", profileHandle: "traveler" }).profileHandle,
        "traveler"
    );
    assert.equal(imageVariantQuerySchema.parse({}).variant, "display");
    assert.equal(
        imageVariantQuerySchema.safeParse({ variant: "large", boardId: 42, profileHandle: "traveler" }).success,
        false
    );
    assert.equal(imageVariantQuerySchema.safeParse({ variant: "huge" }).success, false);
    assert.equal(imageVariantQuerySchema.safeParse({ variant: "large", arbitrary: true }).success, false);
});
