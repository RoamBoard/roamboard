import test from "node:test";
import assert from "node:assert/strict";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import SocialFriendsContent from "@/components/features/social/SocialFriendsContent";
import FindFriendsDialog from "@/components/features/social/FindFriendsDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { FriendUser, FriendBoardSummary, FriendActivityItem } from "@/lib/profile";
import {
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    removeFriendByHandle,
    subscribeToFriendRequestUpdates,
    ProfileApiError
} from "@/lib/profile";

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

test("SocialFriendsContent renders header, audience tabs, and empty state sections", () => {
    const html = renderToStaticMarkup(
        createElement(
            RouterWrapper,
            null,
            createElement(SocialFriendsContent, {
                initialFriends: [],
                initialBoards: [],
                initialActivities: []
            })
        )
    );
    assert.ok(html.includes("SOCIAL"));
    assert.ok(html.includes("FRIENDS"));
    assert.ok(html.includes("ME"));
    assert.ok(html.includes("EXPLORE"));
    assert.ok(html.includes("my friends"));
    assert.ok(html.includes("recent activity"));
    assert.ok(html.includes("feeling inspired?"));
    assert.ok(html.includes("boards created by your friends"));
    assert.ok(html.includes("No travel pals yet"));
});

test("SocialFriendsContent renders friends, activity, and friends boards when available", () => {
    const sampleFriends: FriendUser[] = [
        {
            userId: "u-chloe",
            username: "chloe",
            displayName: "Chloe Martin",
            profilePictureUrl: null,
            bio: "Paris enthusiast",
            location: "Paris, France"
        }
    ];

    const sampleBoards: FriendBoardSummary[] = [
        {
            boardId: 401,
            title: "Paris, obviously",
            description: "Croissants for breakfast",
            owner: {
                userId: "u-chloe",
                username: "chloe",
                displayName: "Chloe Martin",
                profilePictureUrl: null
            },
            coverImageUrl: null,
            createdAt: new Date().toISOString()
        }
    ];

    const sampleActivities: FriendActivityItem[] = [
        {
            activityType: "published_board",
            boardId: 401,
            title: "Paris, obviously",
            owner: {
                userId: "u-chloe",
                username: "chloe",
                displayName: "Chloe Martin",
                profilePictureUrl: null
            },
            coverImageUrl: null,
            timestamp: new Date().toISOString()
        }
    ];

    const html = renderToStaticMarkup(
        createElement(
            RouterWrapper,
            null,
            createElement(SocialFriendsContent, {
                initialFriends: sampleFriends,
                initialBoards: sampleBoards,
                initialActivities: sampleActivities
            })
        )
    );

    assert.ok(html.includes("Chloe Martin"));
    assert.ok(html.includes("@chloe"));
    assert.ok(html.includes("Paris, obviously"));
    assert.ok(html.includes("published a new board"));
    assert.ok(html.includes("add friends"));
    assert.ok(!html.includes("unfriend"));
});

type ElementProps = {
    children?: ReactNode;
    onClick?: () => void | Promise<void>;
    onChange?: (event: { target: { value: string } }) => void;
    disabled?: boolean;
    role?: string;
    type?: string;
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

test("FindFriendsDialog renders search input when open and nothing when closed", () => {
    const closedHtml = renderToStaticMarkup(
        createElement(FindFriendsDialog, {
            open: false,
            onClose: () => {}
        })
    );
    assert.equal(closedHtml, "");

    const openHtml = renderToStaticMarkup(
        createElement(FindFriendsDialog, {
            open: true,
            onClose: () => {}
        })
    );
    assert.ok(openHtml.includes("Find Travelers"));
    assert.ok(openHtml.includes("Search by name or @handle"));
});

test("FindFriendsDialog captures search input and updates query", () => {
    const { nodes } = capture(() => FindFriendsDialog({ open: true, onClose: () => {} }));
    const input = nodes.find((n) => n.type === "input");
    assert.ok(input, "Expected search input inside open dialog");
    assert.equal(input.props.value, "");
    assert.equal(typeof input.props.onChange, "function");
});

test("ConfirmDialog renders accessible alertdialog and executes onCancel and onConfirm actions", () => {
    const events: string[] = [];
    const { nodes } = capture(() =>
        ConfirmDialog({
            title: "Unfriend Chloe Martin?",
            description: "Are you sure you want to remove @chloe from your friends?",
            confirmLabel: "Unfriend",
            onCancel: () => events.push("cancel"),
            onConfirm: () => events.push("confirm")
        })
    );

    const cancelBtn = nodes.find((n) => n.type === "button" && n.props.children === "Cancel");
    const confirmBtn = nodes.find((n) => n.type === "button" && n.props.children === "Unfriend");
    assert.ok(cancelBtn);
    assert.ok(confirmBtn);

    cancelBtn.props.onClick?.();
    confirmBtn.props.onClick?.();
    assert.deepEqual(events, ["cancel", "confirm"]);
});

test("ConfirmDialog renders error alert and disables action buttons when loading", () => {
    const { markup, nodes } = capture(() =>
        ConfirmDialog({
            title: "Unfriend Chloe Martin?",
            description: "Are you sure you want to remove @chloe from your friends?",
            confirmLabel: "Unfriend",
            error: "Could not remove friend. Please try again.",
            loading: true,
            onCancel: () => {},
            onConfirm: () => {}
        })
    );
    assert.ok(markup.includes('role="alert"'));
    assert.ok(markup.includes("Could not remove friend. Please try again."));
    assert.ok(markup.includes("Processing…"));

    const disabledButtons = nodes.filter((n) => n.type === "button" && n.props.disabled);
    assert.equal(disabledButtons.length, 2);
});

test("searchUsers queries backend with query string and limit, stripping leading at-symbol", async (context) => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), init });
        return Response.json({
            data: [
                {
                    userId: "u-traveler",
                    username: "traveler",
                    displayName: "World Traveler",
                    profilePictureUrl: null,
                    bio: "Exploring every corner",
                    location: "Tokyo, Japan",
                    friendshipStatus: "none"
                }
            ]
        });
    });

    const results = await searchUsers("@traveler", 10);
    assert.equal(results.length, 1);
    assert.equal(results[0].userId, "u-traveler");
    assert.equal(results[0].friendshipStatus, "none");
    assert.ok(calls[0].url.endsWith("/api/v1/users/search?q=traveler&limit=10"));
    assert.equal(calls[0].init?.credentials, "include");

    await searchUsers("", 20);
    assert.ok(calls[1].url.endsWith("/api/v1/users/search?limit=20"));
});

test("searchUsers handles API errors and network failures", async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
        return Response.json(
            { error: { code: "INVALID_REQUEST", message: "Query too long" } },
            { status: 400, headers: { "content-type": "application/json" } }
        );
    });

    await assert.rejects(
        () => searchUsers("very-long-invalid-query"),
        (err: Error) => {
            assert.ok(err instanceof ProfileApiError);
            assert.equal(err.status, 400);
            assert.equal(err.code, "INVALID_REQUEST");
            assert.equal(err.message, "Query too long");
            return true;
        }
    );
});

test("sendFriendRequest handles pending and crossed-request accepted statuses", async (context) => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const state = { status: "pending_sent" as "pending_sent" | "accepted" };
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), init });
        return Response.json(
            { data: { requestId: 101, status: state.status } },
            { status: 201, headers: { "content-type": "application/json" } }
        );
    });

    const pendingResult = await sendFriendRequest("elena");
    assert.equal(pendingResult.requestId, 101);
    assert.equal(pendingResult.status, "pending_sent");
    assert.ok(calls[0].url.endsWith("/api/v1/users/by-handle/elena/friend-request"));
    assert.equal(calls[0].init?.method, "POST");

    state.status = "accepted";
    const acceptedResult = await sendFriendRequest("marco");
    assert.equal(acceptedResult.status, "accepted");
    assert.ok(calls[1].url.endsWith("/api/v1/users/by-handle/marco/friend-request"));
});

test("sendFriendRequest rejects when user is already a friend or request already sent", async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
        return Response.json(
            { error: { code: "ALREADY_FRIENDS", message: "Already friends" } },
            { status: 409, headers: { "content-type": "application/json" } }
        );
    });

    await assert.rejects(
        () => sendFriendRequest("existing_friend"),
        (err: Error) => {
            assert.ok(err instanceof ProfileApiError);
            assert.equal(err.status, 409);
            assert.equal(err.code, "ALREADY_FRIENDS");
            return true;
        }
    );
});

test("acceptFriendRequest sends PUT and notifies subscribers, unsubscribing stops events", async (context) => {
    const events: Array<{ type: string; requestId: number }> = [];
    const unsubscribe = subscribeToFriendRequestUpdates((e) => events.push(e));
    context.after(unsubscribe);

    const calls: Array<{ url: string; init?: RequestInit }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), init });
        return Response.json(
            { data: { requestId: 77, status: "accepted" } },
            { headers: { "content-type": "application/json" } }
        );
    });

    const result = await acceptFriendRequest(77);
    assert.equal(result.requestId, 77);
    assert.equal(result.status, "accepted");
    assert.ok(calls[0].url.endsWith("/api/v1/users/me/friend-requests/77/accept"));
    assert.equal(calls[0].init?.method, "PUT");
    assert.deepEqual(events, [{ type: "accept", requestId: 77 }]);

    unsubscribe();
    await acceptFriendRequest(78);
    assert.equal(events.length, 1);
});

test("acceptFriendRequest does not notify subscribers when request fails", async (context) => {
    const events: Array<{ type: string; requestId: number }> = [];
    const unsubscribe = subscribeToFriendRequestUpdates((e) => events.push(e));
    context.after(unsubscribe);

    context.mock.method(globalThis, "fetch", async () => {
        return Response.json(
            { error: { code: "NOT_FOUND", message: "Friend request not found" } },
            { status: 404, headers: { "content-type": "application/json" } }
        );
    });

    await assert.rejects(() => acceptFriendRequest(999));
    assert.equal(events.length, 0);
});

test("rejectFriendRequest sends DELETE and notifies subscribers", async (context) => {
    const events: Array<{ type: string; requestId: number }> = [];
    const unsubscribe = subscribeToFriendRequestUpdates((e) => events.push(e));
    context.after(unsubscribe);

    const calls: Array<{ url: string; init?: RequestInit }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), init });
        return new Response(null, { status: 204 });
    });

    await rejectFriendRequest(88);
    assert.ok(calls[0].url.endsWith("/api/v1/users/me/friend-requests/88"));
    assert.equal(calls[0].init?.method, "DELETE");
    assert.deepEqual(events, [{ type: "reject", requestId: 88 }]);
});

test("removeFriend and removeFriendByHandle send DELETE requests and handle errors", async (context) => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), init });
        return new Response(null, { status: 204 });
    });

    await removeFriend("u-chloe");
    assert.ok(calls[0].url.endsWith("/api/v1/users/me/friends/u-chloe"));
    assert.equal(calls[0].init?.method, "DELETE");

    await removeFriendByHandle("chloe");
    assert.ok(calls[1].url.endsWith("/api/v1/users/by-handle/chloe/friend"));
    assert.equal(calls[1].init?.method, "DELETE");
});

test("removeFriend rejects when friendship is not found", async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
        return Response.json(
            { error: { code: "NOT_FOUND", message: "Friendship not found" } },
            { status: 404, headers: { "content-type": "application/json" } }
        );
    });

    await assert.rejects(
        () => removeFriend("u-unknown"),
        (err: Error) => {
            assert.ok(err instanceof ProfileApiError);
            assert.equal(err.status, 404);
            assert.equal(err.code, "NOT_FOUND");
            return true;
        }
    );
});
