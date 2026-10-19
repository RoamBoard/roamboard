import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ProfileHero from "../src/components/features/profile/ProfileHero";
import ConfirmDialog from "../src/components/ui/ConfirmDialog";
import type { PublicProfile, ProfileStats } from "../src/lib/profile";

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

test("visitor profile keeps biography line breaks and hides owner controls", () => {
    const profile: PublicProfile = {
        username: "traveler",
        displayName: "Traveler",
        description: "First line\nSecond line\n\nFourth line",
        location: null,
        occupation: null,
        languages: [],
        interests: [],
        profilePicture: null
    };
    const html = renderToStaticMarkup(createElement(ProfileHero, { profile, stats: null, isOwner: false }));
    assert.match(html, /First line<br\/>Second line<br\/><br\/>Fourth line/);
    assert.doesNotMatch(html, /edit profile/);
});

test("owner and visitor profiles show saved interests outside the editorial catalog", () => {
    const profile: PublicProfile = {
        username: "traveler",
        displayName: "Traveler",
        description: "",
        location: null,
        occupation: null,
        languages: [],
        interests: ["Food", "Hiking"],
        profilePicture: null
    };

    for (const isOwner of [false, true]) {
        const html = renderToStaticMarkup(createElement(ProfileHero, { profile, stats: null, isOwner }));
        assert.match(html, />Food<\/span>/);
        assert.match(html, /href="\/discover\/vibes\/hiking"/);
        assert.doesNotMatch(html, /href="\/discover\/vibes\/food"/);
    }
});

test("profile portraits use a square frame and the display variant for owners and visitors", () => {
    const profile: PublicProfile = {
        username: "ada_lovelace",
        displayName: "Ada Lovelace",
        description: "",
        location: null,
        occupation: null,
        languages: [],
        interests: [],
        profilePicture: {
            imageId: 42,
            storageKey: null,
            url: "/api/v1/images/42/content?variant=thumbnail&profileHandle=ada_lovelace"
        }
    };
    for (const isOwner of [false, true]) {
        const html = renderToStaticMarkup(createElement(ProfileHero, { profile, stats: null, isOwner }));
        assert.match(html, /aspect-square/);
        assert.doesNotMatch(html, /aspect-\[3\/4\]/);
        assert.match(html, /variant=display/);
        assert.match(html, /profileHandle=ada_lovelace/);
        assert.match(html, /alt="Portrait of Ada Lovelace"/);
    }
});

test("visitor profile shows add friends button in place of edit profile", () => {
    const profile: PublicProfile = {
        username: "traveler",
        displayName: "Traveler",
        description: "",
        location: null,
        occupation: null,
        languages: [],
        interests: [],
        profilePicture: null
    };

    const visitorHtml = renderToStaticMarkup(
        createElement(ProfileHero, { profile, stats: null, isOwner: false, friendshipStatus: "none" })
    );
    assert.match(visitorHtml, /\+ add friends/);
    assert.doesNotMatch(visitorHtml, /edit profile/);

    const pendingHtml = renderToStaticMarkup(
        createElement(ProfileHero, { profile, stats: null, isOwner: false, friendshipStatus: "pending_sent" })
    );
    assert.match(pendingHtml, /request sent/);

    const acceptedHtml = renderToStaticMarkup(
        createElement(ProfileHero, { profile, stats: null, isOwner: false, friendshipStatus: "accepted" })
    );
    assert.match(acceptedHtml, /friends/);
    assert.match(acceptedHtml, /unfriend/);

    const ownerHtml = renderToStaticMarkup(createElement(ProfileHero, { profile, stats: null, isOwner: true }));
    assert.match(ownerHtml, /edit profile/);
    assert.doesNotMatch(ownerHtml, /\+ add friends/);
});

test("ProfileHero renders friends made label in statistics", () => {
    const profile: PublicProfile = {
        username: "traveler",
        displayName: "Traveler",
        description: "",
        location: null,
        occupation: null,
        languages: [],
        interests: [],
        profilePicture: null
    };
    const stats: ProfileStats = {
        countriesVisited: 3,
        citiesExplored: 5,
        continentsCovered: 2,
        photosUploaded: 10,
        activitiesDone: 8,
        boardsCreated: 4,
        friends: 7,
        activitiesSaved: 12,
        boardsSaved: 2
    };
    const html = renderToStaticMarkup(createElement(ProfileHero, { profile, stats, isOwner: true }));
    assert.match(html, /friends<br\s*\/?>made/);
    assert.doesNotMatch(html, />friend<br\s*\/?>made/);
});

test("visitor profile renders statistics row when stats are provided", () => {
    const profile: PublicProfile = {
        username: "rohan",
        displayName: "Rohan",
        description: "",
        location: null,
        occupation: null,
        languages: [],
        interests: [],
        profilePicture: null
    };
    const stats: ProfileStats = {
        countriesVisited: 0,
        citiesExplored: 0,
        continentsCovered: 0,
        photosUploaded: 0,
        activitiesDone: 0,
        boardsCreated: 1,
        friends: 1,
        activitiesSaved: 0,
        boardsSaved: 0
    };
    const html = renderToStaticMarkup(createElement(ProfileHero, { profile, stats, isOwner: false }));
    assert.match(html, /countries<br\s*\/?>visited/);
    assert.match(html, /boards<br\s*\/?>created/);
    assert.match(html, /friends<br\s*\/?>made/);
    assert.match(html, /activities<br\s*\/?>saved/);
    assert.match(html, /boards<br\s*\/?>saved/);
});

test("ProfileHero renders handle and based in metadata styled in top sub-bar for owner only", () => {
    const profile: PublicProfile = {
        username: "rowan",
        displayName: "Rowan Kavanagh",
        description: "",
        location: "Stockholm, Sweden",
        occupation: null,
        languages: [],
        interests: [],
        profilePicture: null
    };
    const ownerHtml = renderToStaticMarkup(createElement(ProfileHero, { profile, stats: null, isOwner: true }));
    assert.match(ownerHtml, />handle<\/span>/);
    assert.match(ownerHtml, />@rowan<\/span>/);
    assert.match(ownerHtml, />based in<\/span>/);
    assert.match(ownerHtml, />Stockholm, Sweden<\/span>/);

    const visitorHtml = renderToStaticMarkup(createElement(ProfileHero, { profile, stats: null, isOwner: false }));
    assert.doesNotMatch(visitorHtml, />handle<\/span>/);
    assert.doesNotMatch(visitorHtml, />@rowan<\/span>/);
    assert.match(visitorHtml, />based in<\/span>/);
    assert.match(visitorHtml, />Stockholm, Sweden<\/span>/);
});

test("ProfileHero sends friend request through real API wiring and transitions state", async (context) => {
    const calls: Array<{ url: string; method?: string }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), method: init?.method });
        return Response.json(
            { data: { requestId: 301, status: "pending_sent" } },
            { status: 201, headers: { "content-type": "application/json" } }
        );
    });

    const profile: PublicProfile = {
        username: "elena",
        displayName: "Elena Rostova",
        description: "",
        location: null,
        occupation: null,
        languages: [],
        interests: [],
        profilePicture: null
    };

    const tracker = { status: "none" };
    const { nodes } = capture(() =>
        ProfileHero({
            profile,
            stats: null,
            isOwner: false,
            friendshipStatus: "none",
            onFriendshipStatusChange: (status) => {
                tracker.status = status;
            }
        })
    );

    const addBtn = nodes.find((n) => n.type === "button" && n.props["aria-label"] === "Add friend");
    assert.ok(addBtn, "Expected + add friends button");

    await addBtn.props.onClick?.();

    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith("/api/v1/users/by-handle/elena/friend-request"));
    assert.equal(calls[0].method, "POST");
    assert.equal(tracker.status, "pending_sent");
});

test("ProfileHero displays visible error when sendFriendRequest fails", async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
        return Response.json(
            { error: { code: "SERVER_ERROR", message: "Failed to create friendship request" } },
            { status: 500, headers: { "content-type": "application/json" } }
        );
    });

    const profile: PublicProfile = {
        username: "elena",
        displayName: "Elena Rostova",
        description: "",
        location: null,
        occupation: null,
        languages: [],
        interests: [],
        profilePicture: null
    };

    const tracker = { error: null as string | null };
    const { nodes } = capture(() =>
        ProfileHero({
            profile,
            stats: null,
            isOwner: false,
            friendshipStatus: "none",
            onActionErrorChange: (err) => {
                tracker.error = err;
            }
        })
    );

    const addBtn = nodes.find((n) => n.type === "button" && n.props["aria-label"] === "Add friend");
    assert.ok(addBtn);

    await addBtn.props.onClick?.();
    assert.equal(tracker.error, "Failed to create friendship request");
});

test("ProfileHero unfriend confirms removal via removeFriendByHandle", async (context) => {
    const calls: Array<{ url: string; method?: string }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), method: init?.method });
        return new Response(null, { status: 204 });
    });

    const profile: PublicProfile = {
        username: "chloe",
        displayName: "Chloe Martin",
        description: "",
        location: null,
        occupation: null,
        languages: [],
        interests: [],
        profilePicture: null
    };

    const tracker = { status: "accepted" };
    const { nodes } = capture(() =>
        ProfileHero({
            profile,
            stats: null,
            isOwner: false,
            friendshipStatus: "accepted",
            initialConfirmUnfriendOpen: true,
            onFriendshipStatusChange: (status) => {
                tracker.status = status;
            }
        })
    );

    const confirmDialog = nodes.find((n) => n.type === ConfirmDialog);
    assert.ok(confirmDialog, "Expected ConfirmDialog to be open");

    await (confirmDialog.props as { onConfirm: () => Promise<void> }).onConfirm();

    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith("/api/v1/users/by-handle/chloe/friend"));
    assert.equal(calls[0].method, "DELETE");
    assert.equal(tracker.status, "none");
});

test("ProfileHero unfriend failure keeps ConfirmDialog open and sets error", async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
        return Response.json(
            { error: { code: "SERVER_ERROR", message: "Could not remove friendship" } },
            { status: 500, headers: { "content-type": "application/json" } }
        );
    });

    const profile: PublicProfile = {
        username: "chloe",
        displayName: "Chloe Martin",
        description: "",
        location: null,
        occupation: null,
        languages: [],
        interests: [],
        profilePicture: null
    };

    const tracker = { error: null as string | null };
    const { nodes } = capture(() =>
        ProfileHero({
            profile,
            stats: null,
            isOwner: false,
            friendshipStatus: "accepted",
            initialConfirmUnfriendOpen: true,
            onActionErrorChange: (err) => {
                tracker.error = err;
            }
        })
    );

    const confirmDialog = nodes.find((n) => n.type === ConfirmDialog);
    assert.ok(confirmDialog, "Expected ConfirmDialog to be open");

    await (confirmDialog.props as { onConfirm: () => Promise<void> }).onConfirm();
    assert.equal(tracker.error, "Could not remove friendship");
});
