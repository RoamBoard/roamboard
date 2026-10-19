import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type MouseEvent as ReactMouseEvent, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import CommentNotificationList from "@/components/features/notifications/CommentNotificationList";
import {
    commentNotificationHref,
    getCommentSubscription,
    listCommentNotifications,
    markCommentNotificationRead,
    setCommentSubscription,
    subscribeToCommentNotificationUpdates,
    type CommentNotification
} from "@/lib/comment-notifications";

test("comment subscription and notification requests use the signed-in API with no cache", async (context) => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), init });
        if (String(input).includes("comment-subscription")) return Response.json({ data: { enabled: true } });
        if (String(input).endsWith("/read"))
            return Response.json({ data: { notificationId: 7, readAt: "2026-01-01T00:00:00.000Z" } });
        return Response.json({ data: [], meta: { nextCursor: null, hasMore: false, unreadCount: 2 } });
    });
    const updates = { count: 0 };
    const unsubscribe = subscribeToCommentNotificationUpdates(() => {
        updates.count += 1;
    });
    context.after(unsubscribe);

    assert.deepEqual(await getCommentSubscription("12"), { enabled: true });
    assert.deepEqual(await setCommentSubscription("12", true), { enabled: true });
    assert.equal((await listCommentNotifications("next cursor")).meta.unreadCount, 2);
    assert.equal((await markCommentNotificationRead(7)).notificationId, 7);
    assert.equal(updates.count, 2);
    assert.equal(calls[0].url.endsWith("/api/v1/boards/12/comment-subscription"), true);
    assert.equal(calls[1].init?.method, "PUT");
    assert.equal(calls[2].url.endsWith("/api/v1/users/me/comment-notifications?cursor=next%20cursor"), true);
    assert.equal(calls[3].url.endsWith("/api/v1/users/me/comment-notifications/7/read"), true);
    assert.equal(calls[3].init?.method, "POST");
    for (const call of calls) {
        assert.equal(call.init?.credentials, "include");
        assert.equal(call.init?.cache, "no-store");
    }
});

test("comment notifications keep the Board anchor and plain-text excerpt", () => {
    const notification: CommentNotification = {
        notificationId: 7,
        boardId: 12,
        boardTitle: "Tokyo",
        commentId: 32,
        commenter: { displayName: "Avery", username: "avery", profilePictureUrl: null },
        excerpt: "Look <here> & enjoy",
        createdAt: "2026-01-01T00:00:00.000Z",
        readAt: null
    };
    const router = {
        bfcacheId: "comment-notification-test",
        back() {},
        forward() {},
        refresh() {},
        push() {},
        replace() {},
        prefetch() {}
    };
    const html = renderToStaticMarkup(
        createElement(
            AppRouterContext.Provider,
            { value: router },
            createElement(CommentNotificationList, { items: [notification], pendingId: null, onOpen: async () => {} })
        )
    );
    assert.equal(commentNotificationHref(notification), "/boards/12#comment-32");
    assert.ok(html.includes("/boards/12#comment-32"));
    assert.ok(html.includes("Look &lt;here&gt; &amp; enjoy"));
    assert.ok(html.includes("Unread"));
});

test("notification links leave modified clicks to the browser", () => {
    const notification: CommentNotification = {
        notificationId: 7,
        boardId: 12,
        boardTitle: "Tokyo",
        commentId: 32,
        commenter: { displayName: "Avery", username: "avery", profilePictureUrl: null },
        excerpt: "New comment",
        createdAt: "2026-01-01T00:00:00.000Z",
        readAt: null
    };
    const state = { opened: 0 };
    const list = CommentNotificationList({
        items: [notification],
        pendingId: null,
        onOpen: async () => {
            state.opened += 1;
        }
    });
    const [row] = list.props.children as ReactElement<{ children: ReactElement[] }>[];
    const link = row.props.children as unknown as ReactElement<{
        onClick: (event: ReactMouseEvent<HTMLAnchorElement>) => void;
    }>;
    const click = (overrides: Partial<ReactMouseEvent<HTMLAnchorElement>>) => {
        const result = { prevented: false };
        link.props.onClick({
            button: 0,
            metaKey: false,
            ctrlKey: false,
            shiftKey: false,
            altKey: false,
            preventDefault: () => {
                result.prevented = true;
            },
            ...overrides
        } as ReactMouseEvent<HTMLAnchorElement>);
        return result.prevented;
    };

    for (const modifier of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
        assert.equal(click({ [modifier]: true }), false);
    }
    assert.equal(click({ button: 1 }), false);
    assert.equal(state.opened, 0);
    assert.equal(click({}), true);
    assert.equal(state.opened, 1);
});
