import assert from "node:assert/strict";
import test from "node:test";
import {
    activeCommentMention,
    commentMentionCount,
    commentMentionLimit,
    commentMentionParts,
    insertCommentMention
} from "../src/lib/comment-mentions";
import { boardCommentLimit, commentLength } from "../src/lib/board-comments";

test("mention suggestions use the handle at the cursor and replace only that token", () => {
    const body = "Thanks @ave for this route";
    const active = activeCommentMention(body, "Thanks @ave".length);
    assert.deepEqual(active, { start: 7, end: 11, query: "ave" });
    assert.deepEqual(insertCommentMention(body, active!, "avery"), {
        value: "Thanks @avery for this route",
        cursor: 14
    });
    assert.equal(activeCommentMention("mail@example.com", 16), null);
});

test("a longer suggestion never removes text from the end of a full draft", () => {
    const fullDraft = `@a ${"x".repeat(boardCommentLimit - 3)}`;
    const mention = activeCommentMention(fullDraft, 2)!;
    assert.equal(commentLength(fullDraft), boardCommentLimit);
    assert.equal(insertCommentMention(fullDraft, mention, "avery"), null);
    assert.equal(fullDraft.endsWith("x".repeat(20)), true);

    const shorterDraft = fullDraft.slice(0, -4);
    const inserted = insertCommentMention(shorterDraft, mention, "avery");
    assert.equal(inserted?.value, `@avery ${"x".repeat(boardCommentLimit - 7)}`);
    assert.equal(commentLength(inserted!.value), boardCommentLimit);
});

test("only resolved mentions become profile links, preserving plain text and old handle spellings", () => {
    assert.deepEqual(commentMentionParts("Hi @Avery and @unknown!", [{ handle: "avery", username: "renamed" }]), [
        { text: "Hi " },
        { text: "@Avery", username: "renamed" },
        { text: " and " },
        { text: "@unknown" },
        { text: "!" }
    ]);
});

test("sentence punctuation stays outside mention links, including dotted handles", () => {
    assert.deepEqual(
        commentMentionParts("Thanks @avery. Ask @traveler.name_2...", [
            { handle: "avery", username: "avery" },
            { handle: "traveler.name_2", username: "traveler.name_2" }
        ]),
        [
            { text: "Thanks " },
            { text: "@avery", username: "avery" },
            { text: ". Ask " },
            { text: "@traveler.name_2", username: "traveler.name_2" },
            { text: "..." }
        ]
    );
    assert.equal(commentMentionCount("@avery. @traveler.name_2."), 2);
});

test("the comment editor counts distinct handles, ignoring case and email addresses", () => {
    const ten = Array.from({ length: commentMentionLimit }, (_, index) => `@person${index}`).join(" ");
    assert.equal(commentMentionCount(`${ten} @PERSON0 mail@example.com`), commentMentionLimit);
    assert.equal(commentMentionCount(`${ten} @person${commentMentionLimit}`), commentMentionLimit + 1);
});
