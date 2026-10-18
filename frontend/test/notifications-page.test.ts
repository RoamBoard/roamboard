import test from "node:test";
import assert from "node:assert/strict";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import NotificationsContent from "@/components/features/notifications/NotificationsContent";
import { subscribeToFriendRequestUpdates, type FriendRequest } from "@/lib/profile";

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

    const { nodes } = capture(() => NotificationsContent({ initialRequests: sampleRequests }));
    const acceptBtn = nodes.find((n) => n.type === "button" && n.props.children === "accept");
    assert.ok(acceptBtn, "Expected accept button to exist");

    await acceptBtn.props.onClick?.();

    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith("/api/v1/users/me/friend-requests/101/accept"));
    assert.equal(calls[0].method, "PUT");
    assert.deepEqual(events, [{ type: "accept", requestId: 101 }]);
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

    const { nodes } = capture(() => NotificationsContent({ initialRequests: sampleRequests }));
    const rejectBtn = nodes.find((n) => n.type === "button" && n.props.children === "reject");
    assert.ok(rejectBtn, "Expected reject button to exist");

    await rejectBtn.props.onClick?.();

    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith("/api/v1/users/me/friend-requests/101"));
    assert.equal(calls[0].method, "DELETE");
    assert.deepEqual(events, [{ type: "reject", requestId: 101 }]);
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

    const { nodes } = capture(() => NotificationsContent({ initialRequests: sampleRequests }));
    const acceptBtn = nodes.find((n) => n.type === "button" && n.props.children === "accept");
    assert.ok(acceptBtn);

    await acceptBtn.props.onClick?.();
    assert.equal(events.length, 0);
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
