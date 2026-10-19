import test from "node:test";
import assert from "node:assert/strict";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup as renderMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import NotificationsContent from "@/components/features/notifications/NotificationsContent";
import { notifyFriendRequestAction, subscribeToFriendRequestUpdates, type FriendRequest } from "@/lib/profile";
import { publishAccountUpdate, signInWithGoogle, type AuthUser } from "@/lib/auth";

function renderToStaticMarkup(node: ReactNode) {
    return renderMarkup(
        createElement(
            AppRouterContext.Provider,
            {
                value: {
                    bfcacheId: "notifications-test",
                    back() {},
                    forward() {},
                    refresh() {},
                    push() {},
                    replace() {},
                    prefetch() {}
                }
            },
            node
        )
    );
}

type ElementProps = {
    children?: ReactNode;
    onClick?: () => void | Promise<void>;
    disabled?: boolean;
    role?: string;
    [key: string]: unknown;
};

function elements(node: ReactNode): Array<{ type: unknown; props: ElementProps }> {
    if (!isValidElement<ElementProps>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(elements)];
}

function capture(render: () => ReactNode) {
    const holder: { tree: ReactNode; nodes: Array<{ type: unknown; props: ElementProps }> } = {
        tree: null,
        nodes: []
    };
    function Probe() {
        holder.tree = render();
        holder.nodes = elements(holder.tree);
        return holder.tree;
    }
    const markup = renderToStaticMarkup(createElement(Probe));
    return { markup, nodes: holder.nodes, tree: holder.tree };
}

function mount(render: () => ReactNode) {
    if (typeof (globalThis as unknown as { self?: unknown }).self === "undefined") {
        (globalThis as unknown as { self: unknown }).self = globalThis;
    }
    const effects: Array<() => void | (() => void)> = [];
    const originalUseEffect = React.useEffect;
    React.useEffect = (effect: () => void | (() => void)) => {
        effects.push(effect);
    };
    try {
        const captured = capture(render);
        const cleanups: Array<() => void> = [];
        for (const effect of effects) {
            const cleanup = effect();
            if (typeof cleanup === "function") {
                cleanups.push(cleanup);
            }
        }
        return {
            ...captured,
            unmount: () => {
                for (const cleanup of cleanups) {
                    cleanup();
                }
            }
        };
    } finally {
        React.useEffect = originalUseEffect;
    }
}

test("NotificationsContent renders empty state when signed out or no requests", () => {
    const html = renderToStaticMarkup(createElement(NotificationsContent, { initialRequests: [] }));
    assert.ok(html.includes("NOTIFICATIONS"));
    assert.ok(html.includes("Sign in to see notifications") || html.includes("All caught up!"));
});

test("NotificationsContent renders requests list with requester details and actions", () => {
    const sampleRequests: FriendRequest[] = [
        {
            requestId: 101,
            requester: {
                userId: "user-101",
                username: "sammy",
                displayName: "Sammy Explorer",
                profilePictureUrl: null
            }
        }
    ];

    const html = renderToStaticMarkup(createElement(NotificationsContent, { initialRequests: sampleRequests }));
    assert.ok(html.includes("NOTIFICATIONS"));
    assert.ok(html.includes("1 pending"));
    assert.ok(html.includes("Sammy Explorer"));
    assert.ok(html.includes("@sammy"));
    assert.ok(html.includes("accept"));
    assert.ok(html.includes("reject"));
});

test("NotificationsContent renders requester avatar image when profilePictureUrl is provided", () => {
    const sampleRequests: FriendRequest[] = [
        {
            requestId: 102,
            requester: {
                userId: "user-102",
                username: "alex",
                displayName: "Alex Rover",
                profilePictureUrl: "/api/v1/images/42/content?variant=thumbnail&profileHandle=alex"
            }
        }
    ];

    const html = renderToStaticMarkup(createElement(NotificationsContent, { initialRequests: sampleRequests }));
    assert.ok(html.includes("Alex Rover"));
    assert.ok(html.includes("src="));
    assert.ok(html.includes("profileHandle=alex"));
});

test("accepting a friend request calls PUT /api/v1/users/me/friend-requests/:id/accept and broadcasts update", async (context) => {
    const events: Array<{ type: string; requestId: number }> = [];
    const unsubscribe = subscribeToFriendRequestUpdates((e) => events.push(e));
    context.after(unsubscribe);

    const calls: Array<{ url: string; method?: string }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), method: init?.method });
        return Response.json(
            { data: { requestId: 101, status: "accepted" } },
            { headers: { "content-type": "application/json" } }
        );
    });

    const sampleRequests: FriendRequest[] = [
        {
            requestId: 101,
            requester: {
                userId: "user-101",
                username: "sammy",
                displayName: "Sammy Explorer",
                profilePictureUrl: null
            }
        }
    ];

    const tracker = { requests: sampleRequests };
    const { nodes } = capture(() =>
        NotificationsContent({
            initialRequests: sampleRequests,
            onRequestsChange: (reqs) => {
                tracker.requests = reqs;
            }
        })
    );
    const acceptBtn = nodes.find((n) => n.type === "button" && n.props.children === "accept");
    assert.ok(acceptBtn, "Expected accept button to exist");

    await acceptBtn.props.onClick?.();

    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith("/api/v1/users/me/friend-requests/101/accept"));
    assert.equal(calls[0].method, "PUT");
    assert.deepEqual(events, [{ type: "accept", requestId: 101 }]);
    assert.equal(tracker.requests.length, 0);
});

test("rejecting a friend request calls DELETE /api/v1/users/me/friend-requests/:id and broadcasts update", async (context) => {
    const events: Array<{ type: string; requestId: number }> = [];
    const unsubscribe = subscribeToFriendRequestUpdates((e) => events.push(e));
    context.after(unsubscribe);

    const calls: Array<{ url: string; method?: string }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), method: init?.method });
        return new Response(null, { status: 204 });
    });

    const sampleRequests: FriendRequest[] = [
        {
            requestId: 101,
            requester: {
                userId: "user-101",
                username: "sammy",
                displayName: "Sammy Explorer",
                profilePictureUrl: null
            }
        }
    ];

    const tracker = { requests: sampleRequests };
    const { nodes } = capture(() =>
        NotificationsContent({
            initialRequests: sampleRequests,
            onRequestsChange: (reqs) => {
                tracker.requests = reqs;
            }
        })
    );
    const rejectBtn = nodes.find((n) => n.type === "button" && n.props.children === "reject");
    assert.ok(rejectBtn, "Expected reject button to exist");

    await rejectBtn.props.onClick?.();

    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith("/api/v1/users/me/friend-requests/101"));
    assert.equal(calls[0].method, "DELETE");
    assert.deepEqual(events, [{ type: "reject", requestId: 101 }]);
    assert.equal(tracker.requests.length, 0);
});

test("accept friend request failure displays error and does not broadcast update", async (context) => {
    const events: Array<{ type: string; requestId: number }> = [];
    const unsubscribe = subscribeToFriendRequestUpdates((e) => events.push(e));
    context.after(unsubscribe);

    context.mock.method(globalThis, "fetch", async () => {
        return Response.json(
            { error: { code: "NOT_FOUND", message: "Request not found" } },
            { status: 404, headers: { "content-type": "application/json" } }
        );
    });

    const sampleRequests: FriendRequest[] = [
        {
            requestId: 101,
            requester: {
                userId: "user-101",
                username: "sammy",
                displayName: "Sammy Explorer",
                profilePictureUrl: null
            }
        }
    ];

    const tracker = { error: null as string | null };
    const { nodes } = capture(() =>
        NotificationsContent({
            initialRequests: sampleRequests,
            onActionErrorChange: (err) => {
                tracker.error = err;
            }
        })
    );
    const acceptBtn = nodes.find((n) => n.type === "button" && n.props.children === "accept");
    assert.ok(acceptBtn);

    await acceptBtn.props.onClick?.();
    assert.equal(events.length, 0);
    assert.equal(tracker.error, "Failed to accept friend request");
});

test("reject friend request failure displays error and does not broadcast update", async (context) => {
    const events: Array<{ type: string; requestId: number }> = [];
    const unsubscribe = subscribeToFriendRequestUpdates((e) => events.push(e));
    context.after(unsubscribe);

    context.mock.method(globalThis, "fetch", async () => {
        return Response.json(
            { error: { code: "SERVER_ERROR", message: "Server database unavailable" } },
            { status: 500, headers: { "content-type": "application/json" } }
        );
    });

    const sampleRequests: FriendRequest[] = [
        {
            requestId: 101,
            requester: {
                userId: "user-101",
                username: "sammy",
                displayName: "Sammy Explorer",
                profilePictureUrl: null
            }
        }
    ];

    const tracker = { error: null as string | null, requests: sampleRequests };
    const { nodes } = capture(() =>
        NotificationsContent({
            initialRequests: sampleRequests,
            onActionErrorChange: (err) => {
                tracker.error = err;
            },
            onRequestsChange: (reqs) => {
                tracker.requests = reqs;
            }
        })
    );
    const rejectBtn = nodes.find((n) => n.type === "button" && n.props.children === "reject");
    assert.ok(rejectBtn);

    await rejectBtn.props.onClick?.();
    assert.equal(events.length, 0);
    assert.equal(tracker.error, "Failed to reject friend request");
    assert.equal(tracker.requests.length, 1);
});

test("NotificationsContent hides friend requests list when signed out", () => {
    const html = renderToStaticMarkup(createElement(NotificationsContent));
    assert.ok(!html.includes("Friend Requests"));
    assert.ok(html.includes("Sign in to see notifications"));
});

test("NotificationsContent renders load error and clicking retry triggers fetch", async (context) => {
    const calls: Array<{ url: string; method?: string }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), method: init?.method });
        return Response.json({ data: [] }, { headers: { "content-type": "application/json" } });
    });

    const { nodes, markup } = capture(() =>
        NotificationsContent({
            initialRequests: [],
            initialError: "Failed to load friend requests. Please check your connection."
        })
    );

    assert.ok(markup.includes("Failed to load friend requests. Please check your connection."));
    assert.ok(markup.includes("Retry"));
    assert.ok(!markup.includes("All caught up!"));

    const retryBtn = nodes.find((n) => n.type === "button" && n.props.children === "Retry");
    assert.ok(retryBtn, "Expected retry button");

    await retryBtn.props.onClick?.();

    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith("/api/v1/users/me/friend-requests"));
});

test("NotificationsContent concurrent accept and reject updates retain both changes without clobbering", async (context) => {
    const deferredAccept: { resolve: (val: Response) => void } = { resolve: () => {} };
    const acceptPromise = new Promise<Response>((res) => {
        deferredAccept.resolve = res;
    });

    const deferredReject: { resolve: (val: Response) => void } = { resolve: () => {} };
    const rejectPromise = new Promise<Response>((res) => {
        deferredReject.resolve = res;
    });

    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/accept")) {
            return acceptPromise;
        }
        if (url.includes("/friend-requests/")) {
            return rejectPromise;
        }
        return Response.json({ data: [] });
    });

    const requests: FriendRequest[] = [
        {
            requestId: 201,
            requester: { userId: "u-201", username: "alice", displayName: "Alice", profilePictureUrl: null }
        },
        {
            requestId: 202,
            requester: { userId: "u-202", username: "bob", displayName: "Bob", profilePictureUrl: null }
        }
    ];

    const tracker = { requests };
    const { nodes } = capture(() =>
        NotificationsContent({
            initialRequests: requests,
            onRequestsChange: (reqs) => {
                tracker.requests = reqs;
            }
        })
    );

    const acceptButtons = nodes.filter((n) => n.type === "button" && n.props.children === "accept");
    const rejectButtons = nodes.filter((n) => n.type === "button" && n.props.children === "reject");
    assert.equal(acceptButtons.length, 2);
    assert.equal(rejectButtons.length, 2);

    const p1 = acceptButtons[0].props.onClick?.();
    const p2 = rejectButtons[1].props.onClick?.();

    deferredAccept.resolve(Response.json({ data: { requestId: 201, status: "accepted" } }));
    await p1;
    assert.equal(tracker.requests.length, 1);
    assert.equal(tracker.requests[0].requestId, 202);

    deferredReject.resolve(new Response(null, { status: 204 }));
    await p2;
    assert.equal(tracker.requests.length, 0);
});

test("NotificationsContent ignores action completion from earlier account after account switch", async (context) => {
    const user1: AuthUser = { userId: "user-1", username: "user1", displayName: "User One" };
    const user2: AuthUser = { userId: "user-2", username: "user2", displayName: "User Two" };

    const deferredAccept: { resolve: (val: Response) => void } = { resolve: () => {} };
    const acceptPromise = new Promise<Response>((res) => {
        deferredAccept.resolve = res;
    });

    const requests1: FriendRequest[] = [
        {
            requestId: 201,
            requester: { userId: "u-201", username: "alice", displayName: "Alice", profilePictureUrl: null }
        }
    ];

    const requests2: FriendRequest[] = [
        {
            requestId: 301,
            requester: { userId: "u-301", username: "bob", displayName: "Bob", profilePictureUrl: null }
        }
    ];

    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/accept")) {
            return acceptPromise;
        }
        if (url.includes("/api/v1/auth/google")) {
            return Response.json({ data: { user: user1, isNew: false } });
        }
        if (url.includes("/api/v1/users/me/friend-requests")) {
            return Response.json({ data: requests2 });
        }
        return Response.json({ data: [] });
    });

    await signInWithGoogle("user1-token");

    const tracker = { requests: requests1 };
    const { nodes, unmount } = mount(() =>
        NotificationsContent({
            initialRequests: requests1,
            initialUserId: user1.userId,
            onRequestsChange: (reqs) => {
                tracker.requests = reqs;
            }
        })
    );
    context.after(unmount);

    const acceptBtn = nodes.find((n) => n.type === "button" && n.props.children === "accept");
    assert.ok(acceptBtn);

    const actionPromise = acceptBtn.props.onClick?.();

    publishAccountUpdate(user2);
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(tracker.requests, requests2);

    deferredAccept.resolve(Response.json({ data: { requestId: 201, status: "accepted" } }));
    await actionPromise;

    assert.deepEqual(tracker.requests, requests2);
});

test("NotificationsContent clears requests and pending action state immediately on account switch, and does not restore old requests on read failure", async (context) => {
    const user1: AuthUser = { userId: "user-1", username: "user1", displayName: "User One" };
    const user2: AuthUser = { userId: "user-2", username: "user2", displayName: "User Two" };

    const deferredRead: { resolve: (val: Response) => void; reject: (err: unknown) => void } = {
        resolve: () => {},
        reject: () => {}
    };
    const readPromise = new Promise<Response>((resolve, reject) => {
        deferredRead.resolve = resolve;
        deferredRead.reject = reject;
    });

    const requests1: FriendRequest[] = [
        {
            requestId: 201,
            requester: { userId: "u-201", username: "alice", displayName: "Alice", profilePictureUrl: null }
        }
    ];

    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/google")) {
            return Response.json({ data: { user: user1, isNew: false } });
        }
        if (url.includes("/api/v1/users/me/friend-requests")) {
            return readPromise;
        }
        return Response.json({ data: [] });
    });

    await signInWithGoogle("user1-token");

    const tracker = { requests: requests1, actionError: null as string | null };
    const { unmount } = mount(() =>
        NotificationsContent({
            initialRequests: requests1,
            initialUserId: user1.userId,
            onRequestsChange: (reqs) => {
                tracker.requests = reqs;
            },
            onActionErrorChange: (err) => {
                tracker.actionError = err;
            }
        })
    );
    context.after(unmount);

    assert.equal(tracker.requests.length, 1);

    publishAccountUpdate(user2);

    assert.deepEqual(tracker.requests, []);

    deferredRead.reject(new Error("Failed to load"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(tracker.requests, []);
});

test("NotificationsContent completes loading even when shared friend request update arrives while reading", async (context) => {
    const user1: AuthUser = { userId: "user-1", username: "user1", displayName: "User One" };

    const deferredRead: { resolve: (val: Response) => void } = {
        resolve: () => {}
    };
    const readPromise = new Promise<Response>((resolve) => {
        deferredRead.resolve = resolve;
    });

    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/google")) {
            return Response.json({ data: { user: user1, isNew: false } });
        }
        if (url.includes("/api/v1/users/me/friend-requests")) {
            return readPromise;
        }
        return Response.json({ data: [] });
    });

    const tracker = { loading: false, requests: [] as FriendRequest[] };
    const { unmount } = mount(() =>
        NotificationsContent({
            onLoadingChange: (l) => {
                tracker.loading = l;
            },
            onRequestsChange: (reqs) => {
                tracker.requests = reqs;
            }
        })
    );
    context.after(unmount);

    publishAccountUpdate(user1);
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(tracker.loading, true);

    notifyFriendRequestAction({ type: "accept", requestId: 999 });

    deferredRead.resolve(
        Response.json({
            data: [
                {
                    requestId: 999,
                    requester: { userId: "u-999", username: "u", displayName: "U", profilePictureUrl: null }
                }
            ]
        })
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(tracker.loading, false);
    assert.deepEqual(tracker.requests, []);
});
