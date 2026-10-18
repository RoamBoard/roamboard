import test from "node:test";
import assert from "node:assert/strict";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import ProfilePageContent from "@/components/features/profile/ProfilePageContent";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { UserProfile, FriendUser } from "@/lib/profile";

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

const mockProfile: UserProfile = {
    id: "user-123",
    username: "wanderer",
    displayName: "Wanderer",
    description: "Explorer of mountains and coastlines",
    location: "Tokyo, Japan",
    occupation: "Photographer",
    languages: ["Japanese", "English"],
    interests: ["Photography", "Mountains"],
    profilePicture: null,
    defaultBoardVisibility: "friends",
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

test("ProfilePageContent renders ACCOUNT and PROFILE header without audience tabs", () => {
    const html = renderToStaticMarkup(createElement(RouterWrapper, null, createElement(ProfilePageContent)));
    assert.ok(html.includes("ACCOUNT"));
    assert.ok(html.includes("PROFILE"));
    assert.ok(!html.includes("Audience filter"));
    assert.ok(!html.includes("EXPLORE"));
});

test("ProfilePageContent separates travel pals load error from empty state and offers retry", () => {
    const { markup, nodes } = capture(() =>
        ProfilePageContent({
            initialProfile: mockProfile,
            initialFriends: [],
            initialSectionErrors: ["Travel pals could not be loaded."]
        })
    );

    assert.ok(markup.includes("Travel pals could not be loaded."));
    assert.ok(markup.includes("Retry"));
    assert.ok(!markup.includes("No travel pals yet"));

    const retryBtn = nodes.find(
        (n) => n.type === "button" && n.props.children === "Retry" && typeof n.props.onClick === "function"
    );
    assert.ok(retryBtn, "Expected retry button for travel pals section error");
});

test("ProfilePageContent renders empty travel pals state when there are no errors and no friends", () => {
    const { markup } = capture(() =>
        ProfilePageContent({
            initialProfile: mockProfile,
            initialFriends: [],
            initialSectionErrors: []
        })
    );

    assert.ok(markup.includes("No travel pals yet"));
    assert.ok(!markup.includes("Travel pals could not be loaded."));
});

test("ProfilePageContent unfriend failure keeps ConfirmDialog open and surfaces error", async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
        return Response.json(
            { error: { code: "SERVER_ERROR", message: "Failed to remove friendship." } },
            { status: 500, headers: { "content-type": "application/json" } }
        );
    });

    const targetFriend: FriendUser = {
        userId: "u-target",
        username: "targetfriend",
        displayName: "Target Friend",
        profilePictureUrl: null,
        bio: null,
        location: null
    };

    const { nodes } = capture(() =>
        ProfilePageContent({
            initialProfile: mockProfile,
            initialFriends: [targetFriend],
            initialConfirmUnfriendTarget: targetFriend
        })
    );

    const confirmDialog = nodes.find((n) => n.type === ConfirmDialog);
    assert.ok(confirmDialog, "Expected ConfirmDialog to be open");

    await (confirmDialog.props as { onConfirm: () => Promise<void> }).onConfirm();
});

test("ProfilePageContent unfriend succeeds and removes friend from list", async (context) => {
    const calls: Array<{ url: string; method?: string }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), method: init?.method });
        return new Response(null, { status: 204 });
    });

    const targetFriend: FriendUser = {
        userId: "u-target",
        username: "targetfriend",
        displayName: "Target Friend",
        profilePictureUrl: null,
        bio: null,
        location: null
    };

    const { nodes } = capture(() =>
        ProfilePageContent({
            initialProfile: mockProfile,
            initialFriends: [targetFriend],
            initialConfirmUnfriendTarget: targetFriend
        })
    );

    const confirmDialog = nodes.find((n) => n.type === ConfirmDialog);
    assert.ok(confirmDialog, "Expected ConfirmDialog to be open");

    await (confirmDialog.props as { onConfirm: () => Promise<void> }).onConfirm();

    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith("/api/v1/users/me/friends/u-target"));
    assert.equal(calls[0].method, "DELETE");
});
