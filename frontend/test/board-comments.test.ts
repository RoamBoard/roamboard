import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BoardComments, {
    BoardCommentRow,
    getCommentFragment,
    subscribeCommentFragment
} from "../src/components/features/boards/BoardComments";
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
const noop = () => {};
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

type ElementProps = {
    children?: ReactNode;
    id?: string;
    type?: string;
    role?: string;
    disabled?: boolean;
    value?: string;
    "aria-label"?: string;
    "aria-pressed"?: boolean;
    onClick?: () => unknown;
    onChange?: (event: { target: { value: string } }) => void;
    onSubmit?: (event: { preventDefault: () => void }) => unknown;
    [key: string]: unknown;
};

function elements(node: ReactNode): Array<{ type: unknown; props: ElementProps }> {
    if (!isValidElement<ElementProps>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(elements)];
}

function mount(context: TestContext, component: () => ReactNode) {
    const states: unknown[] = [];
    const refs: Array<{ current: unknown }> = [];
    const effects: Array<() => void | (() => void)> = [];
    const cleanups: Array<() => void> = [];
    const mounted = { value: false };
    const render = () => {
        const cursor = { state: 0, ref: 0 };
        const original = {
            useState: React.useState,
            useRef: React.useRef,
            useCallback: React.useCallback,
            useEffect: React.useEffect,
            useSyncExternalStore: React.useSyncExternalStore
        };
        const holder: { tree: ReactNode } = { tree: null };
        function Probe() {
            React.useState = ((initial: unknown) => {
                const index = cursor.state++;
                if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
                return [
                    states[index],
                    (next: unknown) => {
                        states[index] = typeof next === "function" ? next(states[index]) : next;
                    }
                ];
            }) as typeof React.useState;
            React.useRef = ((initial: unknown) => (refs[cursor.ref++] ??= { current: initial })) as typeof React.useRef;
            React.useCallback = ((callback: unknown) => callback) as typeof React.useCallback;
            React.useEffect = (effect) => {
                if (!mounted.value) effects.push(effect);
            };
            React.useSyncExternalStore = ((
                _subscribe: unknown,
                _getSnapshot: unknown,
                getServerSnapshot?: () => unknown
            ) => (getServerSnapshot ? getServerSnapshot() : "")) as typeof React.useSyncExternalStore;
            try {
                holder.tree = component();
                return holder.tree;
            } finally {
                Object.assign(React, original);
            }
        }
        const markup = renderToStaticMarkup(createElement(Probe));
        if (!mounted.value) {
            mounted.value = true;
            for (const effect of effects) {
                const cleanup = effect();
                if (typeof cleanup === "function") cleanups.push(cleanup);
            }
        }
        return { markup, nodes: elements(holder.tree) };
    };
    render();
    context.after(() => {
        cleanups.splice(0).forEach((cleanup) => cleanup());
    });
    return { render };
}

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

test("comment targets update after same-page history navigation and fragment changes", (t) => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const browser = Object.assign(new EventTarget(), { location: { hash: "#comment-81" } });
    Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
    t.after(() => {
        if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
        else Reflect.deleteProperty(globalThis, "window");
    });

    const targets: string[] = [];
    const unsubscribe = subscribeCommentFragment(() => targets.push(getCommentFragment()));
    browser.location.hash = "#comment-42";
    browser.dispatchEvent(new Event("roamboard:back-navigation"));
    browser.location.hash = "#comment-7";
    browser.dispatchEvent(new Event("hashchange"));
    browser.location.hash = "#comment-3";
    browser.dispatchEvent(new Event("popstate"));
    assert.deepEqual(targets, ["#comment-42", "#comment-7", "#comment-3"]);

    unsubscribe();
    browser.dispatchEvent(new Event("hashchange"));
    assert.equal(targets.length, 3);
});

test("mounted BoardComments retries initial load failures, retains failed post drafts, prepends posted comments, and loads older pages", async (t) => {
    const state = { failInitialList: true, failPost: true, failOlder: true };
    const postedBodies: string[] = [];
    replaceFetch(t, async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname === "/api/v1/auth/me") {
            return json({ data: { userId: "user-1", username: "avery", displayName: "Avery Lee" } });
        }
        if (url.pathname === "/api/v1/boards/42/comment-subscription") {
            return json({ data: { enabled: init?.method === "PUT" ? false : true } });
        }
        if (url.pathname === "/api/v1/boards/42/comments" && init?.method === "POST") {
            const payload = JSON.parse(String(init.body)) as { body: string };
            postedBodies.push(payload.body);
            if (state.failPost) {
                return json({ error: { code: "SERVER_ERROR", message: "Could not save comment." } }, 500);
            }
            return json({ data: { ...comment(99), body: payload.body } }, 201);
        }
        if (url.pathname === "/api/v1/boards/42/comments") {
            const cursor = url.searchParams.get("cursor");
            if (!cursor) {
                if (state.failInitialList) {
                    return json({ error: { code: "UNAVAILABLE", message: "Comments temporarily offline." } }, 503);
                }
                return json({
                    data: [{ ...comment(81), body: "First page comment" }],
                    meta: { nextCursor: "cursor-page-2", hasMore: true }
                });
            }
            if (state.failOlder) {
                return json({ error: { code: "UNAVAILABLE", message: "Older comments unavailable." } }, 503);
            }
            return json({
                data: [
                    { ...comment(81), body: "Duplicate first page comment" },
                    { ...comment(70), body: "Older page comment" }
                ],
                meta: { nextCursor: null, hasMore: false }
            });
        }
        throw new Error(`Unexpected request: ${url.pathname}`);
    });

    const section = mount(t, () => BoardComments({ boardId: "42" }));
    await flush();

    const failedInitial = section.render();
    assert.match(failedInitial.markup, /Could not load comments\. Comments temporarily offline\./);

    state.failInitialList = false;
    const retryBtn = failedInitial.nodes.find((node) => node.type === "button" && node.props.children === "Retry");
    assert.ok(retryBtn, "Expected initial load retry button");
    await retryBtn.props.onClick?.();
    await flush();

    const loaded = section.render();
    assert.match(loaded.markup, /First page comment/);
    assert.match(loaded.markup, /Load older/);

    const draftInput = loaded.nodes.find((node) => node.props.id === "board-comment-draft");
    assert.ok(draftInput, "Expected comment textarea for signed-in viewer");
    draftInput.props.onChange?.({ target: { value: "  My retained comment draft  " } });

    const withDraft = section.render();
    const form = withDraft.nodes.find((node) => node.type === "form");
    assert.ok(form, "Expected comment submission form");
    await form.props.onSubmit?.({ preventDefault: noop });
    await flush();

    const failedPost = section.render();
    assert.match(failedPost.markup, /Could not save comment\./);
    assert.equal(
        failedPost.nodes.find((node) => node.props.id === "board-comment-draft")?.props.value,
        "  My retained comment draft  "
    );

    state.failPost = false;
    await failedPost.nodes.find((node) => node.type === "form")?.props.onSubmit?.({ preventDefault: noop });
    await flush();

    const afterPost = section.render();
    assert.deepEqual(postedBodies, ["My retained comment draft", "My retained comment draft"]);
    assert.equal(afterPost.nodes.find((node) => node.props.id === "board-comment-draft")?.props.value, "");
    assert.ok(afterPost.markup.indexOf("My retained comment draft") < afterPost.markup.indexOf("First page comment"));

    const loadOlderBtn = afterPost.nodes.find((node) => node.type === "button" && node.props.children === "Load older");
    assert.ok(loadOlderBtn, "Expected Load older button");
    await loadOlderBtn.props.onClick?.();
    await flush();

    const failedOlder = section.render();
    assert.match(failedOlder.markup, /Older comments unavailable\. Try again above\./);

    state.failOlder = false;
    await failedOlder.nodes
        .find((node) => node.type === "button" && node.props.children === "Load older")
        ?.props.onClick?.();
    await flush();

    const withOlder = section.render();
    assert.match(withOlder.markup, /Older page comment/);
    assert.doesNotMatch(withOlder.markup, /Duplicate first page comment/);
    assert.doesNotMatch(withOlder.markup, /Load older/);
});

test("mounted BoardCommentRow edits with retained draft on conflict, reloads current revision, and confirms deletion", async (t) => {
    const state = { mode: "conflict" as "conflict" | "ok", failDelete: true };
    const patchCalls: Array<{ body: string; revision: number }> = [];
    const currentComment: { value: BoardComment } = {
        value: { ...comment(81), body: "Original comment", revision: 1 }
    };
    const deletedIds: number[] = [];

    replaceFetch(t, async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname === "/api/v1/boards/42/comments/81" && init?.method === "PATCH") {
            const payload = JSON.parse(String(init.body)) as { body: string; revision: number };
            patchCalls.push(payload);
            if (state.mode === "conflict") {
                return json({ error: { code: "STALE_COMMENT", message: "This comment was updated elsewhere." } }, 409);
            }
            return json({
                data: {
                    ...currentComment.value,
                    body: payload.body,
                    revision: payload.revision + 1,
                    editedAt: "2026-10-19T15:00:00.000Z"
                }
            });
        }
        if (url.pathname === "/api/v1/boards/42/comments" && (!init?.method || init.method === "GET")) {
            return json({
                data: [{ ...comment(81), body: "Server updated comment", revision: 4 }],
                meta: { nextCursor: null, hasMore: false }
            });
        }
        if (url.pathname === "/api/v1/boards/42/comments/81" && init?.method === "DELETE") {
            if (state.failDelete) {
                return json({ error: { code: "DELETE_FAILED", message: "Could not delete comment." } }, 500);
            }
            return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected request: ${url.pathname}`);
    });

    const row = mount(t, () =>
        BoardCommentRow({
            comment: currentComment.value,
            boardId: "42",
            epoch: 1,
            loginHref: "/login?returnTo=%2Fboards%2F42%23comments",
            onUpdated(updated) {
                currentComment.value = updated;
            },
            onDeleted(commentId) {
                deletedIds.push(commentId);
            }
        })
    );

    const initial = row.render();
    const editBtn = initial.nodes.find((node) => node.props["aria-label"] === "Edit comment");
    assert.ok(editBtn, "Expected Edit comment button");
    editBtn.props.onClick?.();

    const editing = row.render();
    const editInput = editing.nodes.find((node) => node.props.id === "edit-comment-81");
    assert.ok(editInput, "Expected edit textarea");
    assert.equal(editInput.props.value, "Original comment");
    editInput.props.onChange?.({ target: { value: "My edited comment draft" } });

    const dirtyEdit = row.render();
    const editForm = dirtyEdit.nodes.find((node) => node.type === "form");
    assert.ok(editForm, "Expected edit form");
    await editForm.props.onSubmit?.({ preventDefault: noop });
    await flush();

    const conflicted = row.render();
    assert.match(conflicted.markup, /This comment was updated elsewhere\./);
    assert.equal(
        conflicted.nodes.find((node) => node.props.id === "edit-comment-81")?.props.value,
        "My edited comment draft"
    );
    const reloadBtn = conflicted.nodes.find(
        (node) => node.type === "button" && node.props.children === "Reload current comment and keep my draft"
    );
    assert.ok(reloadBtn, "Expected conflict reload button");
    await reloadBtn.props.onClick?.();
    await flush();

    const reloaded = row.render();
    assert.equal(currentComment.value.revision, 4);
    assert.equal(
        reloaded.nodes.find((node) => node.props.id === "edit-comment-81")?.props.value,
        "My edited comment draft"
    );
    assert.doesNotMatch(reloaded.markup, /Reload current comment and keep my draft/);

    state.mode = "ok";
    await reloaded.nodes.find((node) => node.type === "form")?.props.onSubmit?.({ preventDefault: noop });
    await flush();

    const saved = row.render();
    assert.deepEqual(patchCalls, [
        { body: "My edited comment draft", revision: 1 },
        { body: "My edited comment draft", revision: 4 }
    ]);
    assert.equal(currentComment.value.body, "My edited comment draft");
    assert.equal(currentComment.value.revision, 5);
    assert.match(saved.markup, /My edited comment draft/);
    assert.match(saved.markup, /edited/);

    const deleteBtn = saved.nodes.find((node) => node.props["aria-label"] === "Delete comment");
    assert.ok(deleteBtn, "Expected Delete comment button");
    deleteBtn.props.onClick?.();

    const confirming = row.render();
    assert.match(confirming.markup, /Delete this comment\?/);
    const confirmBtn = confirming.nodes.find(
        (node) => node.type === "button" && node.props.children === "Confirm delete"
    );
    assert.ok(confirmBtn, "Expected Confirm delete button");
    await confirmBtn.props.onClick?.();
    await flush();

    const failedDelete = row.render();
    assert.match(failedDelete.markup, /Could not delete comment\./);
    assert.deepEqual(deletedIds, []);

    state.failDelete = false;
    await failedDelete.nodes
        .find((node) => node.type === "button" && node.props.children === "Confirm delete")
        ?.props.onClick?.();
    await flush();

    assert.deepEqual(deletedIds, [81]);
});

test("toggling the notification bell while post refresh is in flight preserves the newer bell choice", async (t) => {
    const subscriptionReads: Array<(response: Response) => void> = [];
    replaceFetch(t, async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname === "/api/v1/auth/me") {
            return json({ data: { userId: "user-1", username: "avery", displayName: "Avery Lee" } });
        }
        if (url.pathname === "/api/v1/boards/42/comment-subscription") {
            if (init?.method === "PUT") {
                const payload = JSON.parse(String(init.body)) as { enabled: boolean };
                return json({ data: { enabled: payload.enabled } });
            }
            if (subscriptionReads.length === 0) {
                subscriptionReads.push(noop);
                return json({ data: { enabled: true } });
            }
            return new Promise<Response>((resolve) => {
                subscriptionReads.push(resolve);
            });
        }
        if (url.pathname === "/api/v1/boards/42/comments" && init?.method === "POST") {
            return json({ data: { ...comment(99), body: "New comment" } }, 201);
        }
        if (url.pathname === "/api/v1/boards/42/comments") {
            return json({ data: [], meta: { nextCursor: null, hasMore: false } });
        }
        throw new Error(`Unexpected request: ${url.pathname}`);
    });

    const section = mount(t, () => BoardComments({ boardId: "42" }));
    await flush();

    const loaded = section.render();
    loaded.nodes
        .find((node) => node.props.id === "board-comment-draft")
        ?.props.onChange?.({
            target: { value: "New comment" }
        });
    await section
        .render()
        .nodes.find((node) => node.type === "form")
        ?.props.onSubmit?.({ preventDefault: noop });
    await flush();

    assert.equal(subscriptionReads.length, 2, "Posting a comment should start a subscription refresh");

    const bellBeforeToggle = section
        .render()
        .nodes.find((node) => node.props["aria-label"] === "Turn off comment notifications");
    assert.ok(bellBeforeToggle, "Bell should initially be enabled");
    await bellBeforeToggle.props.onClick?.();
    await flush();

    assert.ok(
        section.render().nodes.some((node) => node.props["aria-label"] === "Turn on comment notifications"),
        "Bell should reflect the confirmed off choice"
    );

    subscriptionReads[1](json({ data: { enabled: true } }));
    await flush();

    const finalRender = section.render();
    assert.ok(
        finalRender.nodes.some(
            (node) =>
                node.props["aria-label"] === "Turn on comment notifications" && node.props["aria-pressed"] === false
        ),
        "Stale GET after post must not overwrite the newer bell toggle"
    );
});
