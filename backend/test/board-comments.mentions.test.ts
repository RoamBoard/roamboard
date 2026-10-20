import assert from "node:assert/strict";
import test from "node:test";
import { maxCommentMentions, mentionHandles } from "../src/features/board-comments/board-comments.mentions.js";

test("extracts unique handles without treating email addresses or overlong names as mentions", () => {
    assert.deepEqual(mentionHandles("Hi @Avery, @avery and @traveler.name_2!"), ["avery", "traveler.name_2"]);
    assert.deepEqual(mentionHandles("mail@example.com and @" + "x".repeat(65)), []);
    assert.deepEqual(mentionHandles("@a @b.c @not..valid"), ["a", "b.c", "not..valid"]);
});

test("accepts sentence-ending periods without shortening dotted handles", () => {
    assert.deepEqual(mentionHandles("Thanks @avery. Ask @traveler.name_2..."), ["avery", "traveler.name_2"]);
    assert.deepEqual(mentionHandles("Thanks @avery.smith and @avery.smith."), ["avery.smith"]);
});

test("the mention limit counts distinct handles case-insensitively", () => {
    const ten = Array.from({ length: maxCommentMentions }, (_, index) => `@person${index}`).join(" ");
    assert.equal(mentionHandles(ten).length, maxCommentMentions);
    assert.equal(mentionHandles(`${ten} @PERSON0`).length, maxCommentMentions);
    assert.equal(mentionHandles(`${ten} @person${maxCommentMentions}`).length, maxCommentMentions + 1);
});
