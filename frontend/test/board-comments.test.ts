import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BoardComments, { BoardCommentRow } from "../src/components/features/boards/BoardComments";
import { loginDestinationAfterBoardComment, validatedBoardCommentReturnPath } from "../src/lib/board-comment-return";
import {
    BoardCommentApiError,
    commentLength,
    deleteBoardComment,
    editBoardComment,
    limitCommentLength,
    listBoardComments,
    postBoardComment,
    reloadBoardComment,
    type BoardComment
} from "../src/lib/board-comments";

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function replaceFetch(t: TestContext, replacement: typeof fetch) {
    const original = globalThis.fetch;
    globalThis.fetch = replacement;
    t.after(() => {
        globalThis.fetch = original;
    });
}

function comment(commentId: number): BoardComment {
    return {
        commentId,
        boardId: 42,
        body: "Loved this route!",
        author: { displayName: "Avery Lee", username: "avery", profilePictureUrl: null },
        createdAt: "2026-10-19T14:00:00.000Z",
        editedAt: null,
        revision: 1,
        permissions: { canEdit: true, canDelete: true }
    };
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("comment reads use the Board path, session cookie, no cache, and opaque cursor", async (t) => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    replaceFetch(t, async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return json({ data: [comment(81)], meta: { nextCursor: "page+two/==", hasMore: true } });
    });
    const first = await listBoardComments("42");
    const older = await listBoardComments("42", first.meta.nextCursor ?? undefined);
    assert.deepEqual(
        first.data.map((item) => item.commentId),
        [81]
    );
    assert.equal(older.meta.hasMore, true);
    assert.equal(calls[0].url, `${apiOrigin}/api/v1/boards/42/comments`);
    assert.equal(calls[1].url, `${apiOrigin}/api/v1/boards/42/comments?cursor=page%2Btwo%2F%3D%3D`);
    assert.ok(calls.every(({ init }) => init.credentials === "include" && init.cache === "no-store"));
});

test("posting, editing with a revision, and deleting use contract methods and envelopes", async (t) => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    replaceFetch(t, async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        if (init?.method === "DELETE") return new Response(null, { status: 204 });
        return json({ data: comment(81) }, init?.method === "POST" ? 201 : 200);
    });
    assert.equal((await postBoardComment("42", "Loved this route!")).commentId, 81);
    assert.equal((await editBoardComment("42", 81, "Updated", 3)).commentId, 81);
    await deleteBoardComment("42", 81);
    assert.deepEqual(
        calls.map(({ init }) => init.method),
        ["POST", "PATCH", "DELETE"]
    );
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { body: "Loved this route!" });
    assert.deepEqual(JSON.parse(String(calls[1].init.body)), { body: "Updated", revision: 3 });
    assert.ok(calls.every(({ init }) => init.credentials === "include"));
    assert.equal(calls[2].url, `${apiOrigin}/api/v1/boards/42/comments/81`);
});

test("comment errors preserve authentication and stale-revision details", async (t) => {
    replaceFetch(t, async () => json({ error: { code: "STALE_COMMENT", message: "Reload before editing." } }, 409));
    await assert.rejects(editBoardComment("42", 81, "Changed", 1), (error: unknown) => {
        assert.ok(error instanceof BoardCommentApiError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "STALE_COMMENT");
        assert.equal(error.message, "Reload before editing.");
        return true;
    });
});

test("a stale comment can be reloaded through older cursor pages", async (t) => {
    const calls: string[] = [];
    replaceFetch(t, async (url) => {
        calls.push(String(url));
        return calls.length === 1
            ? json({ data: [comment(90)], meta: { nextCursor: "older", hasMore: true } })
            : json({ data: [comment(81)], meta: { nextCursor: null, hasMore: false } });
    });
    assert.equal((await reloadBoardComment("42", 81))?.commentId, 81);
    assert.equal(calls.length, 2);
    assert.match(calls[1], /cursor=older$/);
});

test("the 2,000-character limit counts Unicode code points", () => {
    assert.equal(commentLength("🙂"), 1);
    assert.equal(commentLength("a".repeat(1999) + "🙂"), 2000);
    assert.equal(limitCommentLength("a".repeat(1999) + "🙂extra"), "a".repeat(1999) + "🙂");
});

test("login return paths accept only a Board path with an optional comments fragment", (t) => {
    assert.equal(validatedBoardCommentReturnPath("/boards/42#comments"), "/boards/42#comments");
    assert.equal(validatedBoardCommentReturnPath("/boards/42"), "/boards/42");
    for (const invalid of [
        "https://elsewhere.test/boards/42",
        "//elsewhere.test",
        "/boards/0",
        "/boards/42?next=/admin",
        "javascript:alert(1)",
        "/boards/%34%32#comments"
    ]) {
        assert.equal(validatedBoardCommentReturnPath(invalid), null);
    }
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: { location: { search: "?returnTo=%2Fboards%2F42%23comments" } }
    });
    t.after(() => {
        if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
        else Reflect.deleteProperty(globalThis, "window");
    });
    assert.equal(loginDestinationAfterBoardComment("/welcome"), "/boards/42#comments");
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: { location: { search: "?returnTo=https%3A%2F%2Felsewhere.test" } }
    });
    assert.equal(loginDestinationAfterBoardComment("/welcome"), "/welcome");
});

test("the Editorial section initially renders a separate loading and account state", () => {
    const markup = renderToStaticMarkup(createElement(BoardComments, { boardId: "42" }));
    assert.match(markup, /id="comments"/);
    assert.match(markup, /Comments/);
    assert.doesNotMatch(markup, /Conversation on this Board/);
    assert.ok(markup.indexOf("Checking your account") < markup.indexOf("Loading comments"));
    assert.match(markup, /Loading comments/);
    assert.match(markup, /Checking your account/);
});

test("comment controls follow server permissions and bodies remain plain text", () => {
    const row = (permissions: BoardComment["permissions"]) =>
        renderToStaticMarkup(
            createElement(BoardCommentRow, {
                comment: { ...comment(81), body: "<script>alert(1)</script>\nAnother line", permissions },
                boardId: "42",
                epoch: 0,
                loginHref: "/login?returnTo=%2Fboards%2F42%23comments",
                onUpdated() {},
                onDeleted() {}
            })
        );
    const author = row({ canEdit: true, canDelete: true });
    assert.match(author, /aria-label="Edit comment"/);
    assert.match(author, /aria-label="Delete comment"/);
    assert.match(author, /group-hover\/comment:opacity-100/);
    assert.match(author, /group-focus-within\/comment:opacity-100/);
    assert.doesNotMatch(author, />Edit</);
    assert.doesNotMatch(author, />Delete</);
    assert.match(author, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(author, /whitespace-pre-wrap/);
    const owner = row({ canEdit: false, canDelete: true });
    assert.doesNotMatch(owner, /aria-label="Edit comment"/);
    assert.match(owner, /aria-label="Delete comment"/);
    const viewer = row({ canEdit: false, canDelete: false });
    assert.doesNotMatch(viewer, /aria-label="Edit comment"/);
    assert.doesNotMatch(viewer, /aria-label="Delete comment"/);
});

test("long comments start collapsed with a way to reveal the full text", () => {
    const renderBody = (body: string) =>
        renderToStaticMarkup(
            createElement(BoardCommentRow, {
                comment: { ...comment(81), body },
                boardId: "42",
                epoch: 0,
                loginHref: "/login",
                onUpdated() {},
                onDeleted() {}
            })
        );

    const longComment = renderBody("A thoughtful route through the city. ".repeat(15));
    assert.match(longComment, /max-h-24 overflow-hidden/);
    assert.match(longComment, /aria-expanded="false" aria-controls="comment-body-81"/);
    assert.match(longComment, />View more</);
    assert.doesNotMatch(renderBody("A short comment."), />View more</);
});
