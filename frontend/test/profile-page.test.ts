import test from "node:test";
import assert from "node:assert/strict";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import ProfilePageContent from "@/components/features/profile/ProfilePageContent";
import { VisitorProfileContent } from "@/components/features/profile/HandleProfileContent";
import { ProfileSavedBoardLibrary } from "@/components/features/profile/ProfilePageContent";
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

test("ProfilePageContent renders PROFILE header without audience tabs or ACCOUNT subheading", () => {
    const html = renderToStaticMarkup(createElement(RouterWrapper, null, createElement(ProfilePageContent)));
    assert.ok(!html.includes("ACCOUNT"));
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

test("ProfilePageContent renders friends rail without unfriend button and links to /friends", () => {
    const targetFriend: FriendUser = {
        userId: "u-target",
        username: "targetfriend",
        displayName: "Target Friend",
        profilePictureUrl: null,
        bio: null,
        location: null
    };

    const { markup } = capture(() =>
        ProfilePageContent({
            initialProfile: mockProfile,
            initialFriends: [targetFriend]
        })
    );

    assert.ok(markup.includes("Target Friend"));
    assert.ok(markup.includes("@targetfriend"));
    assert.ok(!markup.includes("unfriend"), "Expected friends rail on profile to not include unfriend button");
    assert.ok(markup.includes("/friends"), "Expected link to /friends page");
    assert.ok(markup.includes("view all (1)"), "Expected view all (1) link");
});

test("visitor profile shows the profile owner's saved and published collections through the shared libraries", () => {
    const saved = {
        boardId: 731,
        title: "Friend's saved trip",
        description: "",
        owner: { id: "author", username: "author", displayName: "Author" },
        coverImageUrl: null,
        savedAt: "2026-10-20T00:00:00Z"
    };
    const { markup, nodes } = capture(() =>
        VisitorProfileContent({
            view: {
                profile: mockProfile,
                isOwner: false,
                friendshipStatus: "accepted",
                stats: {
                    countriesVisited: 0,
                    citiesExplored: 0,
                    continentsCovered: 0,
                    photosUploaded: 0,
                    activitiesDone: 0,
                    boardsCreated: 1,
                    friends: 1,
                    activitiesSaved: 0,
                    boardsSaved: 1
                },
                boards: [
                    { boardId: 732, title: "Friend's published trip", coverImageUrl: null, updatedAt: saved.savedAt }
                ],
                savedBoards: [saved],
                destinations: []
            }
        })
    );
    assert.match(markup, /currently inspired by/);
    assert.match(markup, /my boards/);
    assert.match(markup, /731/);
    assert.match(markup, /732/);
    assert.equal(
        nodes.filter(
            (node) => typeof node.props.href === "string" && node.props.href.startsWith("/boards/collections/")
        ).length,
        2
    );
    const library = nodes.find((node) => node.type === ProfileSavedBoardLibrary);
    assert.ok(library);
    assert.equal(library.props.ownCollection, false, "another user's saves must not become the visitor's bookmarks");
    assert.deepEqual(library.props.boards, [saved]);
});
