import test from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import SocialFriendsContent from "@/components/features/social/SocialFriendsContent";
import FindFriendsDialog from "@/components/features/social/FindFriendsDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { FriendUser, FriendBoardSummary, FriendActivityItem } from "@/lib/profile";

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

test("ConfirmDialog renders accessible alertdialog with title, description, and action buttons", () => {
    const html = renderToStaticMarkup(
        createElement(ConfirmDialog, {
            title: "Unfriend Chloe Martin?",
            description: "Are you sure you want to remove @chloe from your friends?",
            confirmLabel: "Unfriend",
            onCancel: () => {},
            onConfirm: () => {}
        })
    );
    assert.ok(html.includes('role="alertdialog"'));
    assert.ok(html.includes('aria-modal="true"'));
    assert.ok(html.includes("Unfriend Chloe Martin?"));
    assert.ok(html.includes("Are you sure you want to remove @chloe from your friends?"));
    assert.ok(html.includes("Cancel"));
    assert.ok(html.includes("Unfriend"));
});
