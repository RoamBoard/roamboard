import assert from "node:assert/strict";
import test from "node:test";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import ProfileControl from "../src/components/ui/ProfileControl";
import NotificationControl from "../src/components/ui/NotificationControl";
import Sidebar from "../src/components/layout/Sidebar";
import { subscribeToFriendRequestUpdates, type FriendRequest } from "../src/lib/profile";
import { publishAccountUpdate, signInWithGoogle, type AuthUser } from "../src/lib/auth";
import { resetMockStore } from "../src/data/mock-social";

void globalThis.fetch;

const mockRouter = {
    back: () => {},
    forward: () => {},
    refresh: () => {},
    push: () => {},
    replace: () => {},
    prefetch: () => {}
};

function RouterWrapper({ children }: { children: ReactNode }) {
    return createElement(
        AppRouterContext.Provider,
        { value: mockRouter as unknown as Parameters<typeof AppRouterContext.Provider>[0]["value"] },
        children
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
    const markup = renderToStaticMarkup(createElement(RouterWrapper, null, createElement(Probe)));
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

test("ProfileControl renders an account trigger when a user is provided", () => {
    const html = renderToStaticMarkup(
        createElement(
            RouterWrapper,
            null,
            createElement(ProfileControl, {
                user: { name: "Test Traveler", handle: "@traveler" }
            })
        )
    );

    assert.ok(html.includes("Account menu"));
    assert.ok(html.includes("my profile"));
});

test("ProfileControl keeps the account menu closed when signed out", () => {
    const html = renderToStaticMarkup(
        createElement(
            RouterWrapper,
            null,
            createElement(ProfileControl, {
                user: null
            })
        )
    );

    assert.ok(html.includes("Account menu"));
    assert.ok(html.includes('aria-expanded="false"'));
    assert.ok(!html.includes("Color theme"));
});

test("ProfileControl shows the supplied profile photo in regular and sidebar account controls", () => {
    for (const sidebar of [false, true]) {
        const html = renderToStaticMarkup(
            createElement(
                RouterWrapper,
                null,
                createElement(ProfileControl, {
                    user: { name: "Ada Lovelace", handle: "@ada_lovelace", avatarUrl: "https://photos.test/ada.jpg" },
                    sidebar
                })
            )
        );
        assert.ok(
            html.includes('src="https://photos.test/ada.jpg"'),
            `Profile photo should render with sidebar=${sidebar}`
        );
    }
});

test("ProfileControl renders settings link pointing to /settings when sidebar menu is open", () => {
    const html = renderToStaticMarkup(
        createElement(
            RouterWrapper,
            null,
            createElement(ProfileControl, {
                user: { name: "Ada Lovelace", handle: "@ada_lovelace" },
                sidebar: true,
                sidebarAccountOpen: true
            })
        )
    );
    assert.ok(html.includes('href="/settings"'));
    assert.ok(html.includes("settings"));
});

test("ProfileControl does not display Rowan or mock profile data when signed out", () => {
    const html = renderToStaticMarkup(
        createElement(
            RouterWrapper,
            null,
            createElement(ProfileControl, {
                user: null,
                sidebar: true,
                sidebarAccountOpen: true
            })
        )
    );
    assert.ok(html.includes("sign in"));
    assert.ok(!html.includes("Rowan"));
    assert.ok(!html.includes("ROWAN"));
    assert.ok(!html.includes("rowan.mercer"));
});

test("ProfileControl client regression: signs out from a real session with legacy mock-auth data without flashing mock profile", async (context) => {
    resetMockStore();

    // 1. Mock browser storage with legacy mockauth and mock profile keys
    const storage = new Map<string, string>();
    storage.set("roamboard_mock_auth", "true");
    storage.set(
        "roamboard_mock_profile",
        JSON.stringify({
            name: "Rowan Mercer",
            handle: "@rowan.mercer",
            avatarUrl: "https://photos.test/rowan-mock.jpg"
        })
    );

    const mockLocalStorage = {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, String(value)),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear()
    };

    const classList = new Set<string>();
    const mockDocument = {
        documentElement: {
            classList: {
                contains: (cls: string) => classList.has(cls),
                add: (cls: string) => classList.add(cls),
                remove: (cls: string) => classList.delete(cls),
                toggle: (cls: string, force?: boolean) => {
                    if (force ?? !classList.has(cls)) classList.add(cls);
                    else classList.delete(cls);
                }
            }
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true
    };

    const previousWindow = globalThis.window;
    const previousLocalStorage = globalThis.localStorage;
    const previousDocument = globalThis.document;
    const previousAddEventListener = (globalThis as unknown as { addEventListener?: unknown }).addEventListener;
    const previousRemoveEventListener = (globalThis as unknown as { removeEventListener?: unknown })
        .removeEventListener;

    (globalThis as unknown as { window: unknown }).window = globalThis;
    (globalThis as unknown as { localStorage: unknown }).localStorage = mockLocalStorage;
    (globalThis as unknown as { document: unknown }).document = mockDocument;
    (globalThis as unknown as { addEventListener?: unknown }).addEventListener = () => {};
    (globalThis as unknown as { removeEventListener?: unknown }).removeEventListener = () => {};

    context.after(() => {
        resetMockStore();
        if (typeof previousWindow === "undefined") {
            delete (globalThis as unknown as { window?: unknown }).window;
        } else {
            (globalThis as unknown as { window: unknown }).window = previousWindow;
        }
        if (typeof previousLocalStorage === "undefined") {
            delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
        } else {
            (globalThis as unknown as { localStorage: unknown }).localStorage = previousLocalStorage;
        }
        if (typeof previousDocument === "undefined") {
            delete (globalThis as unknown as { document?: unknown }).document;
        } else {
            (globalThis as unknown as { document: unknown }).document = previousDocument;
        }
        if (typeof previousAddEventListener === "undefined") {
            delete (globalThis as unknown as { addEventListener?: unknown }).addEventListener;
        } else {
            (globalThis as unknown as { addEventListener?: unknown }).addEventListener = previousAddEventListener;
        }
        if (typeof previousRemoveEventListener === "undefined") {
            delete (globalThis as unknown as { removeEventListener?: unknown }).removeEventListener;
        } else {
            (globalThis as unknown as { removeEventListener?: unknown }).removeEventListener =
                previousRemoveEventListener;
        }
    });

    const realUser: AuthUser = {
        userId: "user-real-42",
        username: "adalovelace",
        displayName: "Ada Lovelace",
        profilePictureUrl: "https://photos.test/ada.jpg"
    };

    const routerPushCalls: string[] = [];
    const router = {
        ...mockRouter,
        replace: (url: string) => routerPushCalls.push(url)
    };

    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/logout")) {
            return Response.json({ ok: true });
        }
        if (url.includes("/api/v1/auth/google")) {
            return Response.json({ data: { user: realUser, isNew: false } });
        }
        if (url.includes("/api/v1/auth/me")) {
            return Response.json({ data: realUser });
        }
        return Response.json({ data: [] });
    });

    await signInWithGoogle("real-user-credential");

    // Stateful harness that retains React state and executes effects
    const states: Record<number, unknown> = {};
    const refs: Record<number, { current: unknown }> = {};
    const effects: Array<() => void | (() => void)> = [];
    const cleanups: Array<() => void> = [];
    const mounted = { value: false };

    const render = () => {
        const cursor = { state: 0, ref: 0 };
        const original = { useState: React.useState, useRef: React.useRef, useEffect: React.useEffect };
        const holder: { tree: ReactNode } = { tree: null };

        function Probe() {
            React.useState = ((initial: unknown) => {
                const index = cursor.state++;
                if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
                return [
                    states[index],
                    (next: unknown) => {
                        states[index] =
                            typeof next === "function" ? (next as (prev: unknown) => unknown)(states[index]) : next;
                    }
                ];
            }) as typeof React.useState;

            React.useRef = ((initial: unknown) => {
                const index = cursor.ref++;
                return (refs[index] ??= { current: initial });
            }) as typeof React.useRef;

            React.useEffect = (effect) => {
                if (!mounted.value) effects.push(effect);
            };

            try {
                holder.tree = ProfileControl({
                    user: null,
                    sidebar: true,
                    sidebarAccountOpen: true
                });
                return holder.tree;
            } finally {
                Object.assign(React, original);
            }
        }

        const markup = renderToStaticMarkup(
            createElement(
                AppRouterContext.Provider,
                { value: router as unknown as Parameters<typeof AppRouterContext.Provider>[0]["value"] },
                createElement(Probe)
            )
        );

        if (!mounted.value) {
            mounted.value = true;
            for (const effect of effects) {
                const cleanup = effect();
                if (typeof cleanup === "function") cleanups.push(cleanup);
            }
        }

        return { markup, nodes: elements(holder.tree) };
    };

    context.after(() => cleanups.forEach((c) => c()));

    // Initial mount triggers useEffect: restoreMockStore() runs (purging legacy localStorage keys)
    // and observeCurrentUser queries /api/v1/auth/me
    render();

    // Allow observeCurrentUser promise to resolve and setSessionUser(realUser)
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Re-render with logged-in user state
    const loggedInView = render();
    assert.ok(loggedInView.markup.includes("Ada Lovelace"), "Expected real user display name");
    assert.ok(loggedInView.markup.includes("my profile"), "Expected my profile link");
    assert.ok(!loggedInView.markup.includes("Rowan"), "Should not display Rowan while logged in");

    // Legacy mock keys in localStorage should have been removed by restoreMockStore()
    assert.equal(storage.get("roamboard_mock_auth"), undefined, "roamboard_mock_auth must be purged");
    assert.equal(storage.get("roamboard_mock_profile"), undefined, "roamboard_mock_profile must be purged");

    // Locate and click the 'log out' button
    const logoutBtn = loggedInView.nodes.find((n) => n.type === "button" && n.props.children === "log out");
    assert.ok(logoutBtn, "Expected logout button when logged in");

    await logoutBtn.props.onClick?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Re-render after logout has completed
    const signedOutView = render();

    // Verify signed out state
    assert.ok(signedOutView.markup.includes("sign in"), "Expected sign in prompt after logout");
    assert.ok(!signedOutView.markup.includes("log out"), "Log out button should be gone");
    assert.ok(!signedOutView.markup.includes("Ada Lovelace"), "Real user name should be cleared");

    // CRITICAL REGRESSION ASSERTIONS: No Rowan Mercer name, handle, or photo in markup
    assert.ok(!signedOutView.markup.includes("Rowan"), "No Rowan in signed out markup");
    assert.ok(!signedOutView.markup.includes("ROWAN"), "No ROWAN in signed out markup");
    assert.ok(!signedOutView.markup.includes("rowan.mercer"), "No rowan.mercer in signed out markup");
    assert.ok(!signedOutView.markup.includes("rowan-mock.jpg"), "No mock avatar in signed out markup");
    assert.ok(!signedOutView.markup.includes("https://photos.test/ada.jpg"), "No real avatar in signed out markup");
});

test("Sidebar renders navigation links and does not render theme select", () => {
    const html = renderToStaticMarkup(
        createElement(RouterWrapper, null, createElement(Sidebar, { activeHref: "/home" }))
    );
    assert.ok(html.includes("ROAMBOARD"));
    assert.ok(html.includes('href="/home"'));
    assert.ok(html.includes('href="/discover"'));
    assert.ok(!html.includes("Color theme"));
});

test("NotificationControl renders bell trigger, badge counter, and request items when open", () => {
    const requests = [
        {
            requestId: 42,
            requester: {
                userId: "user-1",
                username: "alice",
                displayName: "Alice Wonderland",
                profilePictureUrl: null
            }
        }
    ];

    const closedHtml = renderToStaticMarkup(
        createElement(
            RouterWrapper,
            null,
            createElement(NotificationControl, {
                sidebar: true,
                iconOnly: false,
                open: false,
                initialRequests: requests
            })
        )
    );
    assert.ok(closedHtml.includes("Notifications"));
    assert.ok(closedHtml.includes("notifications"));
    assert.ok(closedHtml.includes("1 pending notifications"));
    assert.ok(!closedHtml.includes("Alice Wonderland"));

    const openHtml = renderToStaticMarkup(
        createElement(
            RouterWrapper,
            null,
            createElement(NotificationControl, {
                sidebar: true,
                iconOnly: false,
                open: true,
                initialRequests: requests
            })
        )
    );
    assert.ok(openHtml.includes("notifications"));
    assert.ok(openHtml.includes("view all"));
    assert.ok(openHtml.includes("Alice Wonderland"));
    assert.ok(openHtml.includes("@alice"));
    assert.ok(openHtml.includes("accept"));
    assert.ok(openHtml.includes("reject"));
});

test("NotificationControl renders error alert and retry button when read fails, clicking retry calls API", async (context) => {
    const calls: Array<{ url: string; method?: string }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), method: init?.method });
        return Response.json({ data: [] }, { headers: { "content-type": "application/json" } });
    });

    const { nodes, markup } = capture(() =>
        NotificationControl({
            sidebar: true,
            iconOnly: false,
            open: true,
            initialRequests: [],
            initialError: "Failed to load notifications. Please try again."
        })
    );

    assert.ok(markup.includes("Failed to load notifications. Please try again."));
    assert.ok(markup.includes("Retry"));
    assert.ok(!markup.includes("No pending notifications"));

    const retryBtn = nodes.find((n) => n.type === "button" && n.props.children === "Retry");
    assert.ok(retryBtn, "Expected retry button");

    await retryBtn.props.onClick?.();

    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith("/api/v1/users/me/friend-requests"));
});

test("NotificationControl accepting a friend request calls PUT /api/v1/users/me/friend-requests/:id/accept and broadcasts update", async (context) => {
    const events: Array<{ type: string; requestId: number }> = [];
    const unsubscribe = subscribeToFriendRequestUpdates((e) => {
        events.push(e);
    });
    context.after(unsubscribe);

    const calls: Array<{ url: string; method?: string }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), method: init?.method });
        return Response.json(
            { data: { requestId: 42, status: "accepted" } },
            { headers: { "content-type": "application/json" } }
        );
    });

    const requests = [
        {
            requestId: 42,
            requester: {
                userId: "user-1",
                username: "alice",
                displayName: "Alice Wonderland",
                profilePictureUrl: null
            }
        }
    ];

    const tracker: { requests: FriendRequest[] } = { requests };
    const { nodes } = capture(() =>
        NotificationControl({
            sidebar: true,
            iconOnly: false,
            open: true,
            initialRequests: requests,
            onRequestsChange: (reqs) => {
                tracker.requests = reqs;
            }
        })
    );

    const acceptBtn = nodes.find((n) => n.type === "button" && n.props.children === "accept");
    assert.ok(acceptBtn, "Expected accept button to exist");

    await acceptBtn.props.onClick?.();

    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith("/api/v1/users/me/friend-requests/42/accept"));
    assert.equal(calls[0].method, "PUT");
    assert.deepEqual(events, [{ type: "accept", requestId: 42 }]);
    assert.equal(tracker.requests.length, 0);
});

test("NotificationControl rejecting a friend request calls DELETE /api/v1/users/me/friend-requests/:id and broadcasts update", async (context) => {
    const events: Array<{ type: string; requestId: number }> = [];
    const unsubscribe = subscribeToFriendRequestUpdates((e) => {
        events.push(e);
    });
    context.after(unsubscribe);

    const calls: Array<{ url: string; method?: string }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), method: init?.method });
        return new Response(null, { status: 204 });
    });

    const requests = [
        {
            requestId: 42,
            requester: {
                userId: "user-1",
                username: "alice",
                displayName: "Alice Wonderland",
                profilePictureUrl: null
            }
        }
    ];

    const tracker: { requests: FriendRequest[] } = { requests };
    const { nodes } = capture(() =>
        NotificationControl({
            sidebar: true,
            iconOnly: false,
            open: true,
            initialRequests: requests,
            onRequestsChange: (reqs) => {
                tracker.requests = reqs;
            }
        })
    );

    const rejectBtn = nodes.find((n) => n.type === "button" && n.props.children === "reject");
    assert.ok(rejectBtn, "Expected reject button to exist");

    await rejectBtn.props.onClick?.();

    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith("/api/v1/users/me/friend-requests/42"));
    assert.equal(calls[0].method, "DELETE");
    assert.deepEqual(events, [{ type: "reject", requestId: 42 }]);
    assert.equal(tracker.requests.length, 0);
});

test("NotificationControl accept failure does not broadcast update", async (context) => {
    const events: Array<{ type: string; requestId: number }> = [];
    const unsubscribe = subscribeToFriendRequestUpdates((e) => {
        events.push(e);
    });
    context.after(unsubscribe);

    context.mock.method(globalThis, "fetch", async () => {
        return Response.json(
            { error: { code: "NOT_FOUND", message: "Request not found" } },
            { status: 404, headers: { "content-type": "application/json" } }
        );
    });

    const requests = [
        {
            requestId: 42,
            requester: {
                userId: "user-1",
                username: "alice",
                displayName: "Alice Wonderland",
                profilePictureUrl: null
            }
        }
    ];

    const tracker = { error: null as string | null };
    const { nodes } = capture(() =>
        NotificationControl({
            sidebar: true,
            iconOnly: false,
            open: true,
            initialRequests: requests,
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

test("NotificationControl reject failure does not broadcast update and displays error", async (context) => {
    const events: Array<{ type: string; requestId: number }> = [];
    const unsubscribe = subscribeToFriendRequestUpdates((e) => {
        events.push(e);
    });
    context.after(unsubscribe);

    context.mock.method(globalThis, "fetch", async () => {
        return Response.json(
            { error: { code: "SERVER_ERROR", message: "Failed to reject friend request" } },
            { status: 500, headers: { "content-type": "application/json" } }
        );
    });

    const requests = [
        {
            requestId: 42,
            requester: {
                userId: "user-1",
                username: "alice",
                displayName: "Alice Wonderland",
                profilePictureUrl: null
            }
        }
    ];

    const tracker: { error: string | null; requests: FriendRequest[] } = { error: null, requests };
    const { nodes } = capture(() =>
        NotificationControl({
            sidebar: true,
            iconOnly: false,
            open: true,
            initialRequests: requests,
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

test("NotificationControl hides requests and counter when signed out", () => {
    const html = renderToStaticMarkup(
        createElement(
            RouterWrapper,
            null,
            createElement(NotificationControl, {
                sidebar: true,
                iconOnly: false,
                open: true
            })
        )
    );
    assert.ok(html.includes("Sign in to see notifications"));
    assert.ok(html.includes("Sign in →"));
    assert.ok(!html.includes("pending requests"));
    assert.ok(!html.includes("No pending notifications"));
});

test("NotificationControl newer read supersedes older pending read", async (context) => {
    const tracker = { count: 0 };
    const deferredOld: { reject: (err: Error) => void } = { reject: () => {} };
    const oldPromise = new Promise<Response>((_, rej) => {
        deferredOld.reject = rej;
    });

    context.mock.method(globalThis, "fetch", async () => {
        tracker.count += 1;
        if (tracker.count === 1) {
            return oldPromise;
        }
        return Response.json(
            {
                data: [
                    {
                        requestId: 99,
                        requester: {
                            userId: "u-99",
                            username: "bob",
                            displayName: "Bob Builder",
                            profilePictureUrl: null
                        }
                    }
                ]
            },
            { headers: { "content-type": "application/json" } }
        );
    });

    const { nodes } = capture(() =>
        NotificationControl({
            sidebar: true,
            iconOnly: false,
            open: true,
            initialRequests: [],
            initialError: "Initial network error"
        })
    );

    const retryBtn = nodes.find((n) => n.type === "button" && n.props.children === "Retry");
    assert.ok(retryBtn, "Expected retry button");

    // First click triggers call 1 (returns hanging oldPromise)
    void retryBtn.props.onClick?.();

    // Second click triggers call 2 (resolves with data)
    await retryBtn.props.onClick?.();

    // Now call 1 rejects after call 2 has finished
    deferredOld.reject(new Error("Old network timeout"));

    assert.equal(tracker.count, 2);
});

test("Sidebar renders navigation links in order without labs, and notification menu above profile control", () => {
    const html = renderToStaticMarkup(
        createElement(RouterWrapper, null, createElement(Sidebar, { activeHref: "/home" }))
    );
    assert.ok(html.includes("ROAMBOARD"));
    assert.ok(html.includes('href="/home"'));
    assert.ok(html.includes('href="/boards"'));
    assert.ok(html.includes('href="/discover"'));
    assert.ok(html.includes('href="/create"'));
    assert.ok(html.includes('href="/social"'));
    assert.ok(!html.includes('href="/dev/providers"'));
    assert.ok(!html.includes(">labs<"));
    assert.ok(html.indexOf('href="/boards"') < html.indexOf('href="/discover"'));
    assert.ok(html.indexOf('href="/discover"') < html.indexOf('href="/create"'));
    assert.ok(html.includes("Notifications"));
    assert.ok(html.includes("Account menu"));

    // Notification menu appears before account menu in DOM order (above it)
    const notifIdx = html.indexOf('aria-label="Notifications"');
    const accountIdx = html.indexOf('aria-label="Account menu"');
    assert.ok(notifIdx !== -1 && accountIdx !== -1 && notifIdx < accountIdx);
});

test("NotificationControl concurrent accept and reject updates retain both changes without clobbering", async (context) => {
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
            requestId: 1,
            requester: { userId: "u-1", username: "alice", displayName: "Alice", profilePictureUrl: null }
        },
        {
            requestId: 2,
            requester: { userId: "u-2", username: "bob", displayName: "Bob", profilePictureUrl: null }
        }
    ];

    const tracker = { requests };
    const { nodes } = capture(() =>
        NotificationControl({
            sidebar: true,
            iconOnly: false,
            open: true,
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

    deferredAccept.resolve(Response.json({ data: { requestId: 1, status: "accepted" } }));
    await p1;
    assert.equal(tracker.requests.length, 1);
    assert.equal(tracker.requests[0].requestId, 2);

    deferredReject.resolve(new Response(null, { status: 204 }));
    await p2;
    assert.equal(tracker.requests.length, 0);
});

test("NotificationControl ignores action completion from earlier account after account switch", async (context) => {
    const user1: AuthUser = { userId: "user-1", username: "user1", displayName: "User One" };
    const user2: AuthUser = { userId: "user-2", username: "user2", displayName: "User Two" };

    const deferredAccept: { resolve: (val: Response) => void } = { resolve: () => {} };
    const acceptPromise = new Promise<Response>((res) => {
        deferredAccept.resolve = res;
    });

    const requests1: FriendRequest[] = [
        {
            requestId: 1,
            requester: { userId: "u-1", username: "alice", displayName: "Alice", profilePictureUrl: null }
        }
    ];

    const requests2: FriendRequest[] = [
        {
            requestId: 2,
            requester: { userId: "u-2", username: "bob", displayName: "Bob", profilePictureUrl: null }
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
        NotificationControl({
            sidebar: true,
            iconOnly: false,
            open: true,
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

    deferredAccept.resolve(Response.json({ data: { requestId: 1, status: "accepted" } }));
    await actionPromise;

    assert.deepEqual(tracker.requests, requests2);
});

test("NotificationControl clears requests and pending action state immediately on account switch, and does not restore old requests on read failure", async (context) => {
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
            requestId: 1,
            requester: { userId: "u-1", username: "alice", displayName: "Alice", profilePictureUrl: null }
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
        NotificationControl({
            sidebar: true,
            iconOnly: false,
            open: true,
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
