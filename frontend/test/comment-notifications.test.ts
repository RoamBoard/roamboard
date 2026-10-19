import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, {
    Children,
    createElement,
    isValidElement,
    type MouseEvent as ReactMouseEvent,
    type ReactElement,
    type ReactNode
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import CommentNotificationList from "@/components/features/notifications/CommentNotificationList";
import CommentNotificationsSection from "@/components/features/notifications/CommentNotificationsSection";
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

function elements(node: ReactNode): Array<{ type: unknown; props: Record<string, unknown> }> {
    if (!isValidElement<Record<string, unknown> & { children?: ReactNode }>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(elements)];
}

function mountSection(context: TestContext, userId: string) {
    const destinations: string[] = [];
    const states: unknown[] = [];
    const refs: Array<{ current: unknown }> = [];
    const effects: Array<() => void | (() => void)> = [];
    const cleanups: Array<() => void> = [];
    const mounted = { value: false };
    const router = {
        bfcacheId: "comment-notification-section-test",
        back() {},
        forward() {},
        refresh() {},
        push: (url: string) => destinations.push(url),
        replace: (url: string) => destinations.push(url),
        prefetch() {}
    };
    const render = () => {
        const cursor = { state: 0, ref: 0 };
        const original = {
            useState: React.useState,
            useRef: React.useRef,
            useCallback: React.useCallback,
            useEffect: React.useEffect
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
            try {
                holder.tree = CommentNotificationsSection({ userId });
                return holder.tree;
            } finally {
                Object.assign(React, original);
            }
        }
        renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, createElement(Probe)));
        if (!mounted.value) {
            mounted.value = true;
            for (const effect of effects) {
                const cleanup = effect();
                if (typeof cleanup === "function") cleanups.push(cleanup);
            }
        }
        return elements(holder.tree);
    };
    render();
    const unmount = () => cleanups.splice(0).forEach((cleanup) => cleanup());
    context.after(unmount);
    return { render, unmount, destinations };
}

test("unmounting CommentNotificationsSection while marking a notification read cancels navigation", async (context) => {
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
    const pendingRead: { resolve?: (response: Response) => void } = {};
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        if (String(input).endsWith("/read")) {
            return new Promise<Response>((resolve) => {
                pendingRead.resolve = resolve;
            });
        }
        return Response.json({ data: [notification], meta: { nextCursor: null, hasMore: false, unreadCount: 1 } });
    });

    const section = mountSection(context, "user-1");
    await new Promise<void>((resolve) => setImmediate(resolve));

    const listNode = section.render().find((node) => node.type === CommentNotificationList);
    assert.ok(listNode, "Expected notification list to render");
    const onOpen = listNode.props.onOpen as (item: CommentNotification) => Promise<void>;
    const openPromise = onOpen(notification);
    assert.ok(pendingRead.resolve, "Expected read request to be in flight");

    section.unmount();
    pendingRead.resolve(Response.json({ data: { notificationId: 7, readAt: "2026-01-01T00:00:00.000Z" } }));
    await openPromise;

    assert.deepEqual(section.destinations, []);
});
