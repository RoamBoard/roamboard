import assert from "node:assert/strict";
import test from "node:test";
import { mentionHandles } from "../src/features/board-comments/board-comments.mentions.js";

test("extracts unique handles without treating email addresses or overlong names as mentions", () => {
    assert.deepEqual(mentionHandles("Hi @Avery, @avery and @traveler.name_2!"), ["avery", "traveler.name_2"]);
    assert.deepEqual(mentionHandles("mail@example.com and @" + "x".repeat(65)), []);
    assert.deepEqual(mentionHandles("@a @b.c @not..valid"), ["a", "b.c", "not..valid"]);
});
