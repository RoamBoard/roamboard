import test from "node:test";
import assert from "node:assert/strict";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import FriendsPageContent from "@/components/features/friends/FriendsPageContent";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FindFriendsDialog from "@/components/features/social/FindFriendsDialog";
import type { FriendUser } from "@/lib/profile";

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
    onChange?: (event: { target: { value: string } }) => void;
    disabled?: boolean;
    role?: string;
    type?: string;
    "aria-label"?: string;
    "aria-pressed"?: boolean;
    value?: string;
    placeholder?: string;
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

const sampleFriends: FriendUser[] = [
    {
        friendshipId: 10,
        userId: "u-alice",
        username: "alice_wonder",
        displayName: "Alice Wonder",
        profilePictureUrl: null,
        bio: "Backpacker and digital nomad",
        location: "Berlin, Germany"
    },
    {
        friendshipId: 20,
        userId: "u-bob",
        username: "bob_travels",
        displayName: "Bob Smith",
        profilePictureUrl: null,
        bio: "Seeking quiet mountain trails",
        location: "Zurich, Switzerland"
    },
    {
        friendshipId: 30,
        userId: "u-chloe",
        username: "chloe_voyage",
        displayName: "Chloe Martin",
        profilePictureUrl: null,
        bio: "Architecture enthusiast",
        location: "Paris, France"
    }
];

test("FriendsPageContent renders empty state when user has no friends", () => {
    const { markup } = capture(() =>
        FriendsPageContent({
            initialFriends: []
        })
    );

    assert.ok(markup.includes("No travel pals yet"));
    assert.ok(markup.includes("Find Friends"));
});

test("FriendsPageContent renders loading state", () => {
    const { markup } = capture(() =>
        FriendsPageContent({
            initialFriends: [],
            initialLoading: true
        })
    );

    assert.ok(markup.includes("Loading travel pals…"));
});

test("FriendsPageContent renders error state and allows retry", async (context) => {
    const calls: string[] = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        calls.push(String(input));
        return Response.json({ data: sampleFriends }, { headers: { "content-type": "application/json" } });
    });

    const { markup, nodes } = capture(() =>
        FriendsPageContent({
            initialFriends: [],
            initialError: "Failed to load travel pals."
        })
    );

    assert.ok(markup.includes("Failed to load travel pals."));
    const retryBtn = nodes.find((n) => n.type === "button" && n.props.children === "Retry");
    assert.ok(retryBtn, "Expected Retry button");

    await (retryBtn.props as { onClick: () => Promise<void> }).onClick();
    assert.ok(calls.some((c) => c.endsWith("/api/v1/users/me/friends")));
});

test("FriendsPageContent renders all friends in grid view with profile links", () => {
    const { markup, nodes } = capture(() =>
        FriendsPageContent({
            initialFriends: sampleFriends
        })
    );

    assert.ok(markup.includes("my friends (3)"));
    assert.ok(markup.includes("Alice Wonder"));
    assert.ok(markup.includes("@alice_wonder"));
    assert.ok(markup.includes("Bob Smith"));
    assert.ok(markup.includes("@bob_travels"));
    assert.ok(markup.includes("Chloe Martin"));
    assert.ok(markup.includes("@chloe_voyage"));
    assert.ok(markup.includes("Berlin, Germany"));
    assert.ok(markup.includes("/profile/alice_wonder"));
    assert.ok(markup.includes("/profile/bob_travels"));
    assert.ok(markup.includes("/profile/chloe_voyage"));

    // Check view mode toggle buttons exist
    const gridBtn = nodes.find((n) => n.type === "button" && n.props["aria-label"] === "Grid view");
    const listBtn = nodes.find((n) => n.type === "button" && n.props["aria-label"] === "List view");
    assert.ok(gridBtn);
    assert.ok(listBtn);
    assert.equal(gridBtn.props["aria-pressed"], true);
    assert.equal(listBtn.props["aria-pressed"], false);
});

test("FriendsPageContent toggles to list view", () => {
    const { nodes } = capture(() =>
        FriendsPageContent({
            initialFriends: sampleFriends
        })
    );

    const listBtn = nodes.find((n) => n.type === "button" && n.props["aria-label"] === "List view");
    assert.ok(listBtn);

    listBtn.props.onClick?.();
});

test("FriendsPageContent filters friends by search query", () => {
    const { nodes } = capture(() =>
        FriendsPageContent({
            initialFriends: sampleFriends
        })
    );

    const searchInput = nodes.find((n) => n.type === "input" && n.props.placeholder?.includes("Search"));
    assert.ok(searchInput);

    // Simulate typing "alice"
    searchInput.props.onChange?.({ target: { value: "alice" } });
});

test("FriendsPageContent changes sorting option", () => {
    const { nodes } = capture(() =>
        FriendsPageContent({
            initialFriends: sampleFriends
        })
    );

    const sortSelect = nodes.find((n) => n.type === "select");
    assert.ok(sortSelect);

    // Sort Z-A
    sortSelect.props.onChange?.({ target: { value: "name-desc" } });
    // Sort recently added
    sortSelect.props.onChange?.({ target: { value: "recent" } });
});

test("FriendsPageContent unfriend failure keeps dialog open and displays error", async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
        return Response.json(
            { error: { code: "SERVER_ERROR", message: "Failed to remove friendship." } },
            { status: 500, headers: { "content-type": "application/json" } }
        );
    });

    const target = sampleFriends[0];
    const { nodes } = capture(() =>
        FriendsPageContent({
            initialFriends: sampleFriends,
            initialConfirmUnfriendTarget: target
        })
    );

    const confirmDialog = nodes.find((n) => n.type === ConfirmDialog);
    assert.ok(confirmDialog, "Expected ConfirmDialog to be open");

    await (confirmDialog.props as { onConfirm: () => Promise<void> }).onConfirm();
});

test("FriendsPageContent unfriend success calls removeFriend and removes friend from list", async (context) => {
    const calls: Array<{ url: string; method?: string }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), method: init?.method });
        return new Response(null, { status: 204 });
    });

    const target = sampleFriends[0];
    const { nodes } = capture(() =>
        FriendsPageContent({
            initialFriends: sampleFriends,
            initialConfirmUnfriendTarget: target
        })
    );

    const confirmDialog = nodes.find((n) => n.type === ConfirmDialog);
    assert.ok(confirmDialog, "Expected ConfirmDialog to be open");

    await (confirmDialog.props as { onConfirm: () => Promise<void> }).onConfirm();

    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith(`/api/v1/users/me/friends/${target.userId}`));
    assert.equal(calls[0].method, "DELETE");
});

test("FriendsPageContent renders FindFriendsDialog when find friends button clicked", () => {
    const { nodes } = capture(() =>
        FriendsPageContent({
            initialFriends: sampleFriends
        })
    );

    const findFriendsBtn = nodes.find(
        (n) => n.type === "button" && Children.toArray(n.props.children).includes(" Find Friends")
    );
    assert.ok(findFriendsBtn, "Expected Find Friends button in header");

    findFriendsBtn.props.onClick?.();

    const dialog = nodes.find((n) => n.type === FindFriendsDialog);
    assert.ok(dialog);
});

