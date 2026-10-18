import assert from "node:assert/strict";
import test from "node:test";
import { boardTags, getAvailableBoardTags } from "../src/data/board-tags";

test("board choices use the complete profile catalog while excluding retired database tags", () => {
    const names = boardTags.map((tag) => tag.name);
    const choices = getAvailableBoardTags(["Food", "Beach", ...names.toReversed(), "Foodie"]);
    assert.deepEqual(
        choices.map((tag) => tag.name),
        names
    );
    assert.ok(choices.some((tag) => tag.name === "Foodie"));
    assert.ok(choices.some((tag) => tag.name === "Café Hopping"));
    assert.ok(!choices.some((tag) => tag.name === "Food" || tag.name === "Beach"));
});

test("board choices never offer a catalog tag without a persisted API name", () => {
    assert.deepEqual(
        getAvailableBoardTags(["Food", "Foodie"]),
        boardTags.filter((tag) => tag.name === "Foodie")
    );
    assert.deepEqual(getAvailableBoardTags([]), []);
});
