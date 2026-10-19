import assert from "node:assert/strict";
import test from "node:test";
import {
    activeCommentMention,
    commentMentionCount,
    commentMentionLimit,
    commentMentionParts,
    insertCommentMention
} from "../src/lib/comment-mentions";

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

test("only resolved mentions become profile links, preserving plain text and old handle spellings", () => {
    assert.deepEqual(commentMentionParts("Hi @Avery and @unknown!", [{ handle: "avery", username: "renamed" }]), [
        { text: "Hi " },
        { text: "@Avery", username: "renamed" },
        { text: " and " },
        { text: "@unknown" },
        { text: "!" }
    ]);
});

test("the comment editor counts distinct handles, ignoring case and email addresses", () => {
    const ten = Array.from({ length: commentMentionLimit }, (_, index) => `@person${index}`).join(" ");
    assert.equal(commentMentionCount(`${ten} @PERSON0 mail@example.com`), commentMentionLimit);
    assert.equal(commentMentionCount(`${ten} @person${commentMentionLimit}`), commentMentionLimit + 1);
});
