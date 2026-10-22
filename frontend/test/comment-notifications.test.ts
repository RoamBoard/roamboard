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
import NotificationControl from "@/components/ui/NotificationControl";
import {
    clearCommentNotifications,
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
        if (String(input).endsWith("/read-all")) return Response.json({ data: { unreadCount: 0 } });
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
    assert.equal((await listCommentNotifications(undefined, true)).meta.unreadCount, 2);
    assert.equal((await markCommentNotificationRead(7)).notificationId, 7);
    assert.deepEqual(await clearCommentNotifications(), { unreadCount: 0 });
    assert.equal(updates.count, 3);
    assert.equal(calls[0].url.endsWith("/api/v1/boards/12/comment-subscription"), true);
    assert.equal(calls[1].init?.method, "PUT");
    assert.equal(calls[2].url.endsWith("/api/v1/users/me/comment-notifications?cursor=next%20cursor"), true);
    assert.equal(calls[3].url.endsWith("/api/v1/users/me/comment-notifications?unreadOnly=true"), true);
    assert.equal(calls[4].url.endsWith("/api/v1/users/me/comment-notifications/7/read"), true);
    assert.equal(calls[4].init?.method, "POST");
    assert.equal(calls[5].url.endsWith("/api/v1/users/me/comment-notifications/read-all"), true);
    assert.equal(calls[5].init?.method, "POST");
    for (const call of calls) {
        assert.equal(call.init?.credentials, "include");
        assert.equal(call.init?.cache, "no-store");
    }
});

test("failed clear preserves notification state and emits no update", async (context) => {
    const updates = { count: 0 };
    const unsubscribe = subscribeToCommentNotificationUpdates(() => {
        updates.count += 1;
    });
    context.after(unsubscribe);
    context.mock.method(globalThis, "fetch", async () =>
        Response.json({ error: { code: "INTERNAL_ERROR", message: "Storage unavailable" } }, { status: 500 })
    );
    await assert.rejects(clearCommentNotifications(), /Storage unavailable/);
    assert.equal(updates.count, 0);
});

test("comment notifications keep the Board anchor and plain-text excerpt", () => {
    const notification: CommentNotification = {
        notificationId: 7,
        boardId: 12,
        boardTitle: "Tokyo",
        commentId: 32,
        kind: "comment",
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
        kind: "comment",
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
    const presence = list.props.children as ReactElement<{ children: ReactElement[] }>;
    const [row] = Children.toArray(presence.props.children) as ReactElement<{ children: ReactElement[] }>[];
    const link = (Array.isArray(row.props.children) ? row.props.children[0] : row.props.children) as ReactElement<{
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

test("mention notifications identify the mention in the shared list", () => {
    const item: CommentNotification = {
        notificationId: 9,
        boardId: 12,
        boardTitle: "Tokyo",
        commentId: 33,
        kind: "mention",
        commenter: { displayName: "Avery", username: "avery", profilePictureUrl: null },
        excerpt: "Hello @morgan",
        createdAt: "2026-01-01T00:00:00.000Z",
        readAt: null
    };
    const router = {
        bfcacheId: "mention-notification-test",
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
            createElement(CommentNotificationList, { items: [item], pendingId: null, onOpen: async () => {} })
        )
    );
    assert.match(html, /Avery mentioned you in Tokyo/);
});

function elements(node: ReactNode): Array<{ type: unknown; props: Record<string, unknown> }> {
    if (!isValidElement<Record<string, unknown> & { children?: ReactNode }>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(elements)];
}

test("dismissing a focused notification moves focus before removing it", () => {
    const notification: CommentNotification = {
        notificationId: 7,
        boardId: 12,
        boardTitle: "Tokyo",
        commentId: 32,
        kind: "comment",
        commenter: { displayName: "Avery", username: "avery", profilePictureUrl: null },
        excerpt: "New comment",
        createdAt: "2026-01-01T00:00:00.000Z",
        readAt: null
    };
    const actions: string[] = [];
    const list = CommentNotificationList({
        items: [notification, { ...notification, notificationId: 8 }],
        pendingId: null,
        onOpen: async () => {},
        onMarkRead: async () => {
            actions.push("mark");
        },
        onDismissFocusFallback: () => actions.push("bell")
    });
    const buttons = elements(list).filter((node) => node.type === "button");
    const nextButton = { focus: () => actions.push("next") };
    const firstButton = {
        ownerDocument: { activeElement: null as unknown },
        closest: () => ({ nextElementSibling: { querySelector: () => nextButton } })
    };
    firstButton.ownerDocument.activeElement = firstButton;
    (buttons[0].props.onClick as (event: { currentTarget: unknown }) => void)({ currentTarget: firstButton });
    assert.deepEqual(actions, ["next", "mark"]);

    actions.length = 0;
    const lastButton = {
        ownerDocument: { activeElement: null as unknown },
        closest: () => ({ nextElementSibling: null })
    };
    lastButton.ownerDocument.activeElement = lastButton;
    (buttons[1].props.onClick as (event: { currentTarget: unknown }) => void)({ currentTarget: lastButton });
    assert.deepEqual(actions, ["bell", "mark"]);
});

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
        kind: "comment",
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

test("the full notifications page offers clear when only hidden unread rows remain", async (context) => {
    const calls: string[] = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        calls.push(String(input));
        if (String(input).endsWith("/read-all")) return Response.json({ data: { unreadCount: 0 } });
        return Response.json({ data: [], meta: { nextCursor: null, hasMore: false, unreadCount: 0 } });
    });
    const section = mountSection(context, "owner");
    await new Promise<void>((resolve) => setImmediate(resolve));
    const button = section
        .render()
        .find((node) => node.type === "button" && node.props.children === "Mark All as Read");
    assert.ok(button);
    await (button.props.onClick as () => Promise<void>)();
    assert.ok(calls.some((url) => url.endsWith("/api/v1/users/me/comment-notifications/read-all")));
});

test("clear failure leaves page history visible; retry marks it read without removing it", async (context) => {
    const item: CommentNotification = {
        notificationId: 17,
        boardId: 12,
        boardTitle: "Tokyo",
        commentId: 32,
        kind: "mention",
        commenter: { displayName: "Avery", username: "avery", profilePictureUrl: null },
        excerpt: "Hello @owner",
        createdAt: "2026-01-01T00:00:00.000Z",
        readAt: null
    };
    const state = { failClear: true, readAt: null as string | null };
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        if (String(input).endsWith("/read-all")) {
            if (state.failClear)
                return Response.json({ error: { code: "INTERNAL_ERROR", message: "Unavailable" } }, { status: 500 });
            state.readAt = "2026-01-01T01:00:00.000Z";
            return Response.json({ data: { unreadCount: 0 } });
        }
        return Response.json({
            data: [{ ...item, readAt: state.readAt }],
            meta: { nextCursor: null, hasMore: false, unreadCount: state.readAt ? 0 : 1 }
        });
    });
    const section = mountSection(context, "owner");
    await new Promise<void>((resolve) => setImmediate(resolve));
    const clear = () => {
        const button = section
            .render()
            .find((node) => node.type === "button" && node.props.children === "Mark All as Read");
        assert.ok(button);
        (button.props.onClick as () => void)();
    };
    clear();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.ok(section.render().some((node) => node.props.role === "alert"));
    assert.equal(
        (
            section.render().find((node) => node.type === CommentNotificationList)?.props.items as CommentNotification[]
        )[0]?.readAt,
        null
    );
    state.failClear = false;
    clear();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(
        (
            section.render().find((node) => node.type === CommentNotificationList)?.props.items as CommentNotification[]
        )[0]?.readAt,
        state.readAt
    );
});

test("the bell marks one comment read without clearing the others or friend requests", async (context) => {
    const owner = { userId: "owner", username: "owner", displayName: "Owner" };
    const friend = {
        requestId: 4,
        requester: { userId: "friend", username: "friend", displayName: "Friend", profilePictureUrl: null }
    };
    const unread: CommentNotification = {
        notificationId: 7,
        boardId: 12,
        boardTitle: "Unread Board",
        commentId: 32,
        kind: "comment",
        commenter: { displayName: "Avery", username: "avery", profilePictureUrl: null },
        excerpt: "New comment",
        createdAt: "2026-01-01T00:00:00.000Z",
        readAt: null
    };
    const secondUnread = { ...unread, notificationId: 8, commentId: 33, boardTitle: "Second Board" };
    const state = {
        cleared: false,
        readIds: new Set<number>(),
        listUrls: [] as string[],
        releaseClear: null as (() => void) | null
    };
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/auth/me")) return Response.json({ data: owner });
        if (url.endsWith("/friend-requests")) return Response.json({ data: [friend] });
        if (url.endsWith("/7/read")) {
            state.readIds.add(7);
            return Response.json({ data: { notificationId: 7, readAt: "2026-10-22T00:00:00.000Z" } });
        }
        if (url.endsWith("/read-all")) {
            await new Promise<void>((resolve) => {
                state.releaseClear = resolve;
            });
            state.cleared = true;
            return Response.json({ data: { unreadCount: 0 } });
        }
        if (url.includes("/comment-notifications")) {
            state.listUrls.push(url);
            assert.ok(url.includes("unreadOnly=true"));
            const remaining = state.cleared
                ? []
                : [unread, secondUnread].filter((item) => !state.readIds.has(item.notificationId));
            return Response.json({
                data: remaining,
                meta: { nextCursor: null, hasMore: false, unreadCount: remaining.length }
            });
        }
        return Response.json({ data: [] });
    });
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
                holder.tree = NotificationControl({
                    open: true,
                    initialRequests: [friend],
                    initialUserId: owner.userId
                });
                return holder.tree;
            } finally {
                Object.assign(React, original);
            }
        }
        const html = renderToStaticMarkup(
            createElement(
                AppRouterContext.Provider,
                {
                    value: {
                        bfcacheId: "bell-clear-test",
                        back() {},
                        forward() {},
                        refresh() {},
                        push() {},
                        replace() {},
                        prefetch() {}
                    }
                },
                createElement(Probe)
            )
        );
        if (!mounted.value) {
            mounted.value = true;
            for (const effect of effects.splice(0)) {
                const cleanup = effect();
                if (typeof cleanup === "function") cleanups.push(cleanup);
            }
        }
        return { html, nodes: elements(holder.tree) };
    };
    context.after(() => cleanups.forEach((cleanup) => cleanup()));
    render();
    await new Promise<void>((resolve) => setImmediate(resolve));
    const before = render();
    assert.ok(before.html.includes("Unread Board"));
    assert.ok(before.html.includes("Second Board"));
    assert.ok(before.html.includes("3 pending notifications"));
    assert.ok(before.html.includes('aria-label="Mark notification from Avery on Unread Board as read"'));
    assert.ok(!before.html.includes(">Mark as read<"));
    assert.ok(before.html.includes("Friend"));
    const list = before.nodes.find((node) => node.type === CommentNotificationList);
    assert.ok(list);
    const marking = (list.props.onMarkRead as (notification: CommentNotification) => Promise<void>)(unread);
    const dismissing = render();
    assert.ok(!dismissing.html.includes("Unread Board"));
    assert.ok(dismissing.html.includes("Second Board"));
    const remainingList = dismissing.nodes.find((node) => node.type === CommentNotificationList);
    assert.ok(remainingList);
    const remainingButton = elements(
        CommentNotificationList(remainingList.props as Parameters<typeof CommentNotificationList>[0])
    ).find((node) => node.type === "button");
    assert.equal(remainingButton?.props.disabled, undefined);
    assert.equal(remainingButton?.props["aria-disabled"], true);
    await marking;
    await new Promise<void>((resolve) => setImmediate(resolve));
    const afterOne = render();
    assert.ok(!afterOne.html.includes("Unread Board"));
    assert.ok(afterOne.html.includes("Second Board"));
    assert.ok(afterOne.html.includes("2 pending notifications"));
    assert.ok(afterOne.html.includes("Friend"));
    assert.ok(state.readIds.has(7));
    assert.equal(state.cleared, false);
    const button = afterOne.nodes.find(
        (node) => node.type === "button" && node.props.children === "Clear all notifications"
    );
    assert.ok(button);
    const trigger = afterOne.nodes.find(
        (node) => node.type === "button" && node.props["aria-label"] === "Notifications"
    );
    assert.ok(trigger);
    const focusedClearButton = {
        ownerDocument: { activeElement: null as unknown },
        closest: () => ({ contains: (element: unknown) => element === focusedClearButton })
    };
    focusedClearButton.ownerDocument.activeElement = focusedClearButton;
    (button.props.ref as { current: unknown }).current = focusedClearButton;
    const focusMoves = { count: 0 };
    (trigger.props.ref as { current: unknown }).current = { focus: () => (focusMoves.count += 1) };
    (button.props.onClick as () => void)();
    assert.equal(focusMoves.count, 1);
    const duringClear = render();
    const pendingButton = duringClear.nodes.find(
        (node) => node.type === "button" && node.props.children === "Clear all notifications"
    );
    assert.equal(pendingButton?.props.disabled, true);
    assert.ok(!duringClear.html.includes("Clearing…"));
    assert.ok(state.releaseClear);
    state.releaseClear();
    await new Promise<void>((resolve) => setImmediate(resolve));
    const after = render();
    assert.ok(!after.html.includes("Unread Board"));
    assert.ok(!after.html.includes("Second Board"));
    assert.ok(after.html.includes("1 pending notifications"));
    assert.ok(after.html.includes("Friend"));
    assert.ok(state.listUrls.length >= 2);
});
