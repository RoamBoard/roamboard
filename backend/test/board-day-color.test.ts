import assert from "node:assert/strict";
import test from "node:test";
import { createBoardSchema, replaceBoardSchema } from "../src/features/boards/boards.schemas.js";

const draft = {
    status: "draft",
    title: "Weekend",
    description: null,
    visibility: "public",
    tagIds: [],
    imageIds: [],
    days: [{ dayNumber: 1, date: null, activities: [] }]
};

test("day colors accept lowercase six-digit hex and explicit reset without changing older omitted writes", () => {
    for (const schema of [createBoardSchema, replaceBoardSchema]) {
        const input = { ...draft, ...(schema === replaceBoardSchema ? { revision: 2 } : {}) };
        assert.equal(schema.parse(input).days[0]?.color, undefined);
        for (const color of [null, "#000000", "#ffffff", "#c58e76"]) {
            assert.equal(schema.parse({ ...input, days: [{ ...draft.days[0], color }] }).days[0]?.color, color);
        }
        for (const color of [
            "red",
            "#fff",
            "#AABBCC",
            "#12345678",
            "123456",
            "#12345g",
            " #123456",
            "#123456 ",
            123456,
            true,
            {},
            []
        ]) {
            assert.equal(
                schema.safeParse({ ...input, days: [{ ...draft.days[0], color }] }).success,
                false,
                String(color)
            );
        }
    }
});
