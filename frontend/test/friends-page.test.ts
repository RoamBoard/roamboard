import test from "node:test";
import assert from "node:assert/strict";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import FriendsPage from "@/app/friends/page";
import FriendsPageContent, { type FriendsPageContentProps } from "@/components/features/friends/FriendsPageContent";
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
    open?: boolean;
    [key: string]: unknown;
};

function elements(node: ReactNode): Array<{ type: unknown; props: ElementProps; key?: string | null }> {
    if (!isValidElement<ElementProps>(node)) return [];
    const children = isValidElement(node.props.children)
        ? [node.props.children]
        : Array.isArray(node.props.children)
          ? node.props.children
          : [];
    return [{ type: node.type, props: node.props, key: node.key }, ...children.flatMap(elements)];
}

function createStatefulHarness(initialProps: FriendsPageContentProps = {}) {
    const state: Record<number, unknown> = {};
    const refs: Record<number, { current: unknown }> = {};
    const holder: { tree: ReactNode } = { tree: null };

    const render = () => {
        const cursor = { state: 0, ref: 0 };
        const original = {
            useState: React.useState,
            useRef: React.useRef
        };

        function Probe() {
            React.useState = ((initial: unknown) => {
                const index = cursor.state++;
                if (!(index in state)) {
                    state[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
                }
                return [
                    state[index],
                    (next: unknown) => {
                        state[index] =
                            typeof next === "function" ? (next as (prev: unknown) => unknown)(state[index]) : next;
                    }
                ];
            }) as typeof React.useState;

            React.useRef = ((initial: unknown) => {
                const index = cursor.ref++;
                return (refs[index] ??= { current: initial });
            }) as typeof React.useRef;

            try {
                holder.tree = FriendsPageContent(initialProps);
                return holder.tree;
            } finally {
                Object.assign(React, original);
            }
        }

        const markup = renderToStaticMarkup(createElement(RouterWrapper, null, createElement(Probe)));
        const nodes = elements(holder.tree);
        return { markup, nodes, tree: holder.tree };
    };

    return { render };
}

const sampleFriends: FriendUser[] = [
    {
        friendshipId: 10,
        acceptedAt: "2026-10-15T12:00:00.000Z",
        userId: "u-alice",
        username: "alice_wonder",
        displayName: "Alice Wonder",
        profilePictureUrl: null,
        bio: "Backpacker and digital nomad",
        location: "Berlin, Germany"
    },
    {
        friendshipId: 20,
        acceptedAt: "2026-10-17T12:00:00.000Z",
        userId: "u-bob",
        username: "bob_travels",
        displayName: "Bob Smith",
        profilePictureUrl: null,
        bio: "Seeking quiet mountain trails",
        location: "Zurich, Switzerland"
    },
    {
        friendshipId: 30,
        acceptedAt: "2026-10-19T12:00:00.000Z",
        userId: "u-chloe",
        username: "chloe_voyage",
        displayName: "Chloe Martin",
        profilePictureUrl: null,
        bio: "Architecture enthusiast",
        location: "Paris, France"
    }
];

test("FriendsPageContent renders empty state when user has no friends", () => {
    const harness = createStatefulHarness({ initialFriends: [] });
    const { markup } = harness.render();

    assert.ok(markup.includes("No travel pals yet"));
    assert.ok(markup.includes("Find Friends"));
});

test("FriendsPageContent renders loading state", () => {
    const harness = createStatefulHarness({ initialFriends: [], initialLoading: true });
    const { markup } = harness.render();

    assert.ok(markup.includes("Loading travel pals…"));
});

test("FriendsPageContent renders error state and allows retry", async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
        return Response.json({ data: sampleFriends }, { headers: { "content-type": "application/json" } });
    });

    const harness = createStatefulHarness({
        initialFriends: [],
        initialError: "Failed to load travel pals."
    });

    const initial = harness.render();
    assert.ok(initial.markup.includes("Failed to load travel pals."));
    const retryBtn = initial.nodes.find((n) => n.type === "button" && n.props.children === "Retry");
    assert.ok(retryBtn, "Expected Retry button");

    await (retryBtn.props as { onClick: () => Promise<void> }).onClick();

    const afterRetry = harness.render();
    assert.ok(!afterRetry.markup.includes("Failed to load travel pals."));
    assert.ok(afterRetry.markup.includes("Alice Wonder"));
});

test("FriendsPageContent toggles between grid view and list view and updates visible DOM", () => {
    const harness = createStatefulHarness({ initialFriends: sampleFriends });
    const initial = harness.render();

    const gridBtn = initial.nodes.find((n) => n.type === "button" && n.props["aria-label"] === "Grid view");
    const listBtn = initial.nodes.find((n) => n.type === "button" && n.props["aria-label"] === "List view");
    assert.ok(gridBtn);
    assert.ok(listBtn);
    assert.equal(gridBtn.props["aria-pressed"], true);
    assert.equal(listBtn.props["aria-pressed"], false);

    // Switch to List View
    listBtn.props.onClick?.();

    const afterListToggle = harness.render();
    const updatedGridBtn = afterListToggle.nodes.find(
        (n) => n.type === "button" && n.props["aria-label"] === "Grid view"
    );
    const updatedListBtn = afterListToggle.nodes.find(
        (n) => n.type === "button" && n.props["aria-label"] === "List view"
    );
    assert.ok(updatedGridBtn);
    assert.ok(updatedListBtn);
    assert.equal(updatedGridBtn.props["aria-pressed"], false);
    assert.equal(updatedListBtn.props["aria-pressed"], true);
    assert.ok(afterListToggle.markup.includes("divide-y"), "Expected list view divide-y container");

    // Switch back to Grid View
    updatedGridBtn.props.onClick?.();

    const afterGridToggle = harness.render();
    const finalGridBtn = afterGridToggle.nodes.find(
        (n) => n.type === "button" && n.props["aria-label"] === "Grid view"
    );
    const finalListBtn = afterGridToggle.nodes.find(
        (n) => n.type === "button" && n.props["aria-label"] === "List view"
    );
    assert.ok(finalGridBtn);
    assert.ok(finalListBtn);
    assert.equal(finalGridBtn.props["aria-pressed"], true);
    assert.equal(finalListBtn.props["aria-pressed"], false);
});

test("FriendsPageContent filters friends in real time and updates visible results", () => {
    const harness = createStatefulHarness({ initialFriends: sampleFriends });
    const initial = harness.render();

    assert.ok(initial.markup.includes("Alice Wonder"));
    assert.ok(initial.markup.includes("Bob Smith"));
    assert.ok(initial.markup.includes("Chloe Martin"));

    const searchInput = initial.nodes.find((n) => n.type === "input" && n.props.placeholder?.includes("Search"));
    assert.ok(searchInput);

    // Filter by name "alice"
    searchInput.props.onChange?.({ target: { value: "alice" } });
    const filteredAlice = harness.render();
    assert.ok(filteredAlice.markup.includes("Alice Wonder"));
    assert.ok(!filteredAlice.markup.includes("Bob Smith"));
    assert.ok(!filteredAlice.markup.includes("Chloe Martin"));
    assert.ok(filteredAlice.markup.includes("Showing 1 of 3 travel pals"));

    // Filter by location "Paris"
    const searchInputParis = filteredAlice.nodes.find(
        (n) => n.type === "input" && n.props.placeholder?.includes("Search")
    );
    assert.ok(searchInputParis);
    searchInputParis.props.onChange?.({ target: { value: "Paris" } });
    const filteredParis = harness.render();
    assert.ok(!filteredParis.markup.includes("Alice Wonder"));
    assert.ok(!filteredParis.markup.includes("Bob Smith"));
    assert.ok(filteredParis.markup.includes("Chloe Martin"));

    // Filter by non-matching query
    const searchInputNone = filteredParis.nodes.find(
        (n) => n.type === "input" && n.props.placeholder?.includes("Search")
    );
    assert.ok(searchInputNone);
    searchInputNone.props.onChange?.({ target: { value: "nonexistent" } });
    const filteredEmpty = harness.render();
    assert.ok(filteredEmpty.markup.includes("No friends match") && filteredEmpty.markup.includes("nonexistent"));
    const clearBtn = filteredEmpty.nodes.find((n) => n.type === "button" && n.props.children === "Clear search");
    assert.ok(clearBtn);

    // Click clear search
    clearBtn.props.onClick?.();
    const cleared = harness.render();
    assert.ok(cleared.markup.includes("Alice Wonder"));
    assert.ok(cleared.markup.includes("Bob Smith"));
    assert.ok(cleared.markup.includes("Chloe Martin"));
});

test("FriendsPageContent sorts friends by name and recently added", () => {
    const harness = createStatefulHarness({ initialFriends: sampleFriends });
    const initial = harness.render();

    // Default: name-asc (Alice -> Bob -> Chloe)
    const posAlice = initial.markup.indexOf("Alice Wonder");
    const posBob = initial.markup.indexOf("Bob Smith");
    const posChloe = initial.markup.indexOf("Chloe Martin");
    assert.ok(posAlice < posBob, "Alice should appear before Bob in A-Z");
    assert.ok(posBob < posChloe, "Bob should appear before Chloe in A-Z");

    const sortSelect = initial.nodes.find((n) => n.type === "select");
    assert.ok(sortSelect);

    // Change to name-desc (Chloe -> Bob -> Alice)
    sortSelect.props.onChange?.({ target: { value: "name-desc" } });
    const descRender = harness.render();
    const descAlice = descRender.markup.indexOf("Alice Wonder");
    const descBob = descRender.markup.indexOf("Bob Smith");
    const descChloe = descRender.markup.indexOf("Chloe Martin");
    assert.ok(descChloe < descBob, "Chloe should appear before Bob in Z-A");
    assert.ok(descBob < descAlice, "Bob should appear before Alice in Z-A");

    // Change to recent (Chloe id:30 -> Bob id:20 -> Alice id:10)
    const sortSelectRecent = descRender.nodes.find((n) => n.type === "select");
    assert.ok(sortSelectRecent);
    sortSelectRecent.props.onChange?.({ target: { value: "recent" } });
    const recentRender = harness.render();
    const recentAlice = recentRender.markup.indexOf("Alice Wonder");
    const recentBob = recentRender.markup.indexOf("Bob Smith");
    const recentChloe = recentRender.markup.indexOf("Chloe Martin");
    assert.ok(recentChloe < recentBob, "Chloe (id:30) should appear before Bob (id:20) in recent");
    assert.ok(recentBob < recentAlice, "Bob (id:20) should appear before Alice (id:10) in recent");
});

test("FriendsPageContent unfriend flow handles dialog cancel, error, and successful removal", async (context) => {
    const failureState = { shouldFail: false };
    context.mock.method(globalThis, "fetch", async () => {
        if (failureState.shouldFail) {
            return Response.json(
                { error: { message: "Server failed to remove friend." } },
                { status: 500, headers: { "content-type": "application/json" } }
            );
        }
        return new Response(null, { status: 204 });
    });

    const harness = createStatefulHarness({ initialFriends: sampleFriends });
    const initial = harness.render();

    // Find unfriend button for Alice
    const unfriendAlice = initial.nodes.find(
        (n) => n.type === "button" && n.props["aria-label"] === "Unfriend Alice Wonder"
    );
    assert.ok(unfriendAlice, "Expected unfriend button for Alice Wonder");

    // Open confirm dialog
    unfriendAlice.props.onClick?.();
    const openDialogRender = harness.render();
    assert.ok(openDialogRender.markup.includes("Unfriend Alice Wonder?"));
    const confirmDialog = openDialogRender.nodes.find((n) => n.type === ConfirmDialog);
    assert.ok(confirmDialog);

    // Cancel dialog
    (confirmDialog.props as { onCancel: () => void }).onCancel();
    const afterCancel = harness.render();
    assert.ok(!afterCancel.markup.includes("Unfriend Alice Wonder?"));
    assert.ok(afterCancel.markup.includes("Alice Wonder"));

    // Re-open dialog
    const unfriendAliceAgain = afterCancel.nodes.find(
        (n) => n.type === "button" && n.props["aria-label"] === "Unfriend Alice Wonder"
    );
    assert.ok(unfriendAliceAgain);
    unfriendAliceAgain.props.onClick?.();

    const dialogReopened = harness.render();
    const confirmDialogReopened = dialogReopened.nodes.find((n) => n.type === ConfirmDialog);
    assert.ok(confirmDialogReopened);

    // Trigger failure
    failureState.shouldFail = true;
    await (confirmDialogReopened.props as { onConfirm: () => Promise<void> }).onConfirm();

    const afterFail = harness.render();
    assert.ok(afterFail.markup.includes("Unfriend Alice Wonder?"), "Dialog should stay open on error");
    assert.ok(afterFail.markup.includes("Server failed to remove friend."), "Error should be displayed");

    // Trigger success
    failureState.shouldFail = false;
    const dialogToSucceed = afterFail.nodes.find((n) => n.type === ConfirmDialog);
    assert.ok(dialogToSucceed);
    await (dialogToSucceed.props as { onConfirm: () => Promise<void> }).onConfirm();

    const afterSuccess = harness.render();
    assert.ok(!afterSuccess.markup.includes("Unfriend Alice Wonder?"), "Dialog should close after success");
    assert.ok(!afterSuccess.markup.includes("Alice Wonder"), "Alice Wonder should be removed from visible friends");
    assert.ok(afterSuccess.markup.includes("my friends (2)"), "Count should update to 2");
    assert.ok(afterSuccess.markup.includes("Bob Smith"));
    assert.ok(afterSuccess.markup.includes("Chloe Martin"));
});

test("FriendsPageContent prevents in-flight read from resurrecting a confirmed unfriended friend", async (context) => {
    const deferredFetch: { resolve: (res: Response) => void } = { resolve: () => {} };
    const delayedPromise = new Promise<Response>((resolve) => {
        deferredFetch.resolve = resolve;
    });

    const tracker = { fetchCount: 0 };
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        if (init?.method === "DELETE") {
            return new Response(null, { status: 204 });
        }
        tracker.fetchCount++;
        return delayedPromise;
    });

    const harness = createStatefulHarness({ initialFriends: sampleFriends });
    const initial = harness.render();

    // Trigger discovery action that calls fetchFriends
    const findFriendsDialog = initial.nodes.find((n) => n.type === FindFriendsDialog);
    assert.ok(findFriendsDialog);
    const onFriendAdded = findFriendsDialog.props.onFriendAdded as () => void;
    onFriendAdded(); // Starts in-flight fetchFriends()
    assert.equal(tracker.fetchCount, 1);

    // While fetch is pending, user unfriends Alice Wonder
    const unfriendAlice = initial.nodes.find(
        (n) => n.type === "button" && n.props["aria-label"] === "Unfriend Alice Wonder"
    );
    assert.ok(unfriendAlice);
    unfriendAlice.props.onClick?.();

    const dialogRender = harness.render();
    const confirmDialog = dialogRender.nodes.find((n) => n.type === ConfirmDialog);
    assert.ok(confirmDialog);
    await (confirmDialog.props as { onConfirm: () => Promise<void> }).onConfirm();

    // After unfriend, Alice is removed while background fetch is still in flight
    const afterUnfriend = harness.render();
    assert.ok(!afterUnfriend.markup.includes("Alice Wonder"));
    assert.ok(afterUnfriend.markup.includes("Bob Smith"));

    // Now resolve the older delayed fetch with all 3 friends (including Alice)
    deferredFetch.resolve(Response.json({ data: sampleFriends }, { headers: { "content-type": "application/json" } }));
    await new Promise<void>((resolve) => setImmediate(resolve));

    // Re-render and ensure Alice was NOT resurrected
    const afterStaleResponse = harness.render();
    assert.ok(
        !afterStaleResponse.markup.includes("Alice Wonder"),
        "Alice Wonder must not be resurrected by stale in-flight response"
    );
    assert.ok(afterStaleResponse.markup.includes("my friends (2)"));
    assert.ok(afterStaleResponse.markup.includes("Bob Smith"));
    assert.ok(afterStaleResponse.markup.includes("Chloe Martin"));
});

test("FriendsPageContent renders FindFriendsDialog when find friends button clicked", () => {
    const harness = createStatefulHarness({ initialFriends: sampleFriends });
    const initial = harness.render();

    const findFriendsBtn = initial.nodes.find(
        (n) => n.type === "button" && Children.toArray(n.props.children).includes(" Find Friends")
    );
    assert.ok(findFriendsBtn, "Expected Find Friends button in header");

    findFriendsBtn.props.onClick?.();

    const afterClick = harness.render();
    const dialog = afterClick.nodes.find((n) => n.type === FindFriendsDialog);
    assert.ok(dialog);
    assert.equal(dialog.props.open, true);
});

test("FriendsPageContent sorts Recently added by acceptance time rather than request creation order", () => {
    const friendsWithMixedTimes: FriendUser[] = [
        {
            friendshipId: 99,
            acceptedAt: "2026-10-01T10:00:00.000Z", // Requested recently (id 99), but accepted long ago
            userId: "u-early-accepted",
            username: "early_friend",
            displayName: "Early Accepted",
            profilePictureUrl: null,
            bio: null,
            location: null
        },
        {
            friendshipId: 2,
            acceptedAt: "2026-10-19T10:00:00.000Z", // Requested long ago (id 2), but accepted today
            userId: "u-late-accepted",
            username: "late_friend",
            displayName: "Late Accepted",
            profilePictureUrl: null,
            bio: null,
            location: null
        }
    ];

    const harness = createStatefulHarness({ initialFriends: friendsWithMixedTimes });
    const initial = harness.render();

    const sortSelect = initial.nodes.find((n) => n.type === "select");
    assert.ok(sortSelect);

    sortSelect.props.onChange?.({ target: { value: "recent" } });
    const recentRender = harness.render();

    const posLate = recentRender.markup.indexOf("Late Accepted");
    const posEarly = recentRender.markup.indexOf("Early Accepted");
    assert.ok(
        posLate < posEarly,
        "Friend accepted today (Late Accepted) must sort before friend accepted earlier, despite smaller friendshipId"
    );
});

test("FriendsPageContent restores renewed friend after previous unfriend when discovery adds them in fresh read", async (context) => {
    const fetchFriendsData = { current: sampleFriends };
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        if (init?.method === "DELETE") {
            return new Response(null, { status: 204 });
        }
        return Response.json({ data: fetchFriendsData.current }, { headers: { "content-type": "application/json" } });
    });

    const harness = createStatefulHarness({ initialFriends: sampleFriends });
    const initial = harness.render();

    // 1. Unfriend Alice
    const unfriendAlice = initial.nodes.find(
        (n) => n.type === "button" && n.props["aria-label"] === "Unfriend Alice Wonder"
    );
    assert.ok(unfriendAlice);
    unfriendAlice.props.onClick?.();

    const dialogRender = harness.render();
    const confirmDialog = dialogRender.nodes.find((n) => n.type === ConfirmDialog);
    assert.ok(confirmDialog);
    await (confirmDialog.props as { onConfirm: () => Promise<void> }).onConfirm();

    // Alice is now removed
    const afterUnfriend = harness.render();
    assert.ok(!afterUnfriend.markup.includes("Alice Wonder"));
    assert.ok(afterUnfriend.markup.includes("my friends (2)"));

    // 2. User accepts/adds Alice again in FindFriendsDialog, triggering onFriendAdded
    const findFriendsDialog = afterUnfriend.nodes.find((n) => n.type === FindFriendsDialog);
    assert.ok(findFriendsDialog);
    const onFriendAdded = findFriendsDialog.props.onFriendAdded as () => void;

    // Simulate fresh loadFriends returning renewed friendship for Alice
    fetchFriendsData.current = [
        ...sampleFriends.filter((f) => f.userId !== "u-alice"),
        {
            ...sampleFriends[0],
            acceptedAt: "2026-10-19T18:00:00.000Z"
        }
    ];

    onFriendAdded(); // Starts fresh fetchFriends() with readId > removalReadId
    await new Promise<void>((resolve) => setImmediate(resolve));

    // 3. Re-render: Alice must be restored because the read was started after the confirmed removal
    const afterReAdd = harness.render();
    assert.ok(
        afterReAdd.markup.includes("Alice Wonder"),
        "Renewed friend must appear after being re-added in fresh discovery read"
    );
    assert.ok(afterReAdd.markup.includes("my friends (3)"));
});

test("FriendsPageContent renders accessible aria-label on avatar links in both grid and list views", () => {
    const harness = createStatefulHarness({ initialFriends: sampleFriends });
    const gridRender = harness.render();

    // Check grid view avatar link
    const gridAvatarLink = gridRender.nodes.find((n) => n.props["aria-label"] === "Alice Wonder's profile");
    assert.ok(gridAvatarLink, "Grid view avatar link must have accessible aria-label naming the friend");

    // Switch to list view
    const listBtn = gridRender.nodes.find((n) => n.type === "button" && n.props["aria-label"] === "List view");
    assert.ok(listBtn);
    listBtn.props.onClick?.();

    const listRender = harness.render();
    const listAvatarLink = listRender.nodes.find((n) => n.props["aria-label"] === "Alice Wonder's profile");
    assert.ok(listAvatarLink, "List view avatar link must have accessible aria-label naming the friend");
});

test("FriendsPageContent ignores failure from superseded read when newer read succeeds", async (context) => {
    const r1Deferred: { reject: (err: Error) => void } = { reject: () => {} };
    const r1Promise = new Promise<Response>((_, reject) => {
        r1Deferred.reject = reject;
    });

    const callTracker = { count: 0 };
    context.mock.method(globalThis, "fetch", async () => {
        callTracker.count++;
        if (callTracker.count === 1) {
            // First read is delayed and will later fail
            return r1Promise;
        }
        // Second read succeeds immediately
        return Response.json({ data: sampleFriends }, { headers: { "content-type": "application/json" } });
    });

    const harness = createStatefulHarness({ initialFriends: [] });
    const initial = harness.render();

    const findFriendsDialog = initial.nodes.find((n) => n.type === FindFriendsDialog);
    assert.ok(findFriendsDialog);
    const onFriendAdded = findFriendsDialog.props.onFriendAdded as () => void;

    // Trigger read 1 (delayed)
    onFriendAdded();
    assert.equal(callTracker.count, 1);

    // Trigger read 2 (supersedes read 1, succeeds)
    onFriendAdded();
    assert.equal(callTracker.count, 2);
    await new Promise<void>((resolve) => setImmediate(resolve));

    // Newer read succeeded
    const afterSuccess = harness.render();
    assert.ok(afterSuccess.markup.includes("Alice Wonder"));
    assert.ok(!afterSuccess.markup.includes("Failed to load your travel pals."));

    // Now older read 1 fails
    r1Deferred.reject(new Error("Network connection dropped on read 1"));
    await new Promise<void>((resolve) => setImmediate(resolve));

    // Re-render: older failure must be ignored and not overwrite friends list
    const finalRender = harness.render();
    assert.ok(
        finalRender.markup.includes("Alice Wonder"),
        "Friends list must remain visible and not be replaced by older failure"
    );
    assert.ok(
        !finalRender.markup.includes("Failed to load your travel pals."),
        "Error from older superseded read must not be displayed"
    );
});

test("FriendsPageContent renders other user's friends with custom title and hides owner controls (find friends, unfriend)", () => {
    const harness = createStatefulHarness({
        initialFriends: sampleFriends,
        handle: "alice",
        targetDisplayName: "Alice Wonder"
    });
    const gridRender = harness.render();

    assert.match(
        gridRender.markup,
        /Alice Wonder(&#x27;|')s friends \(3\)/,
        "Header should display other user's friends title"
    );
    assert.ok(
        gridRender.markup.includes("travelers @alice is connected with"),
        "Subtitle should indicate travelers of target user"
    );

    // Verify Find Friends button is NOT rendered
    assert.ok(
        !gridRender.markup.includes("Find Friends"),
        "Find Friends button must not be present when viewing another user's friends"
    );

    // Verify unfriend button is NOT rendered in grid view
    const unfriendBtnsGrid = gridRender.nodes.filter(
        (n) => typeof n.props["aria-label"] === "string" && n.props["aria-label"].startsWith("Unfriend")
    );
    assert.equal(unfriendBtnsGrid.length, 0, "Unfriend button must not be present in grid view for other user");

    // Switch to list view
    const listBtn = gridRender.nodes.find((n) => n.type === "button" && n.props["aria-label"] === "List view");
    assert.ok(listBtn);
    listBtn.props.onClick?.();

    const listRender = harness.render();
    const unfriendBtnsList = listRender.nodes.filter(
        (n) => typeof n.props["aria-label"] === "string" && n.props["aria-label"].startsWith("Unfriend")
    );
    assert.equal(unfriendBtnsList.length, 0, "Unfriend button must not be present in list view for other user");
});

test("FriendsPageContent renders empty state for other user's friends without Find Friends button", () => {
    const harness = createStatefulHarness({
        initialFriends: [],
        handle: "bob"
    });
    const render = harness.render();

    assert.match(
        render.markup,
        /@bob hasn(&#x27;|')t connected with any travel pals yet\./,
        "Empty state should mention the target handle"
    );
    assert.ok(
        !render.markup.includes("Find Friends"),
        "Find Friends button must not be present in empty state for other user"
    );
});

test("FriendsPageContent retry fetches other user's friends from /api/v1/users/by-handle/:handle/friends", async (context) => {
    const calls: Array<{ url: string }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        calls.push({ url: String(input) });
        return Response.json({ data: sampleFriends }, { headers: { "content-type": "application/json" } });
    });

    const harness = createStatefulHarness({
        initialFriends: [],
        initialError: "Failed to load travel pals.",
        handle: "chloe"
    });
    const initial = harness.render();
    const retryBtn = initial.nodes.find((n) => n.type === "button" && n.props.children === "Retry");
    assert.ok(retryBtn, "Expected Retry button");

    await (retryBtn.props as { onClick: () => Promise<void> }).onClick();

    assert.ok(
        calls.some((c) => c.url.includes("/api/v1/users/by-handle/chloe/friends")),
        "Must fetch friends from by-handle endpoint for the specified user"
    );
});

test("FriendsPage keys FriendsPageContent by handle", async () => {
    const defaultPage = await FriendsPage({});
    const alicePage = await FriendsPage({
        searchParams: Promise.resolve({ handle: "alice" })
    });

    const defaultElements = elements(defaultPage);
    const aliceElements = elements(alicePage);

    const defaultContent = defaultElements.find((el) => el.type === FriendsPageContent);
    const aliceContent = aliceElements.find((el) => el.type === FriendsPageContent);

    assert.ok(defaultContent, "FriendsPageContent should be in default page tree");
    assert.ok(aliceContent, "FriendsPageContent should be in alice page tree");
    assert.equal(defaultContent.key, "");
    assert.equal(aliceContent.key, "alice");
});

test("FriendsPageContent resets loginRequired and page state when handle changes", async (context) => {
    const isSuccess = { current: false };
    context.mock.method(globalThis, "fetch", async () => {
        if (isSuccess.current) {
            return Response.json({ data: sampleFriends }, { headers: { "content-type": "application/json" } });
        }
        return new Response(JSON.stringify({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }), {
            status: 401,
            headers: { "content-type": "application/json" }
        });
    });

    const harness = createStatefulHarness({
        initialFriends: [],
        initialError: "Failed to load travel pals.",
        handle: null
    });
    const initial = harness.render();
    const retryBtn = initial.nodes.find((n) => n.type === "button" && n.props.children === "Retry");
    assert.ok(retryBtn, "Expected Retry button");

    await (retryBtn.props as { onClick: () => Promise<void> }).onClick();

    const loginRender = harness.render();
    assert.ok(
        loginRender.markup.includes("Sign in to see and manage all your travel pals"),
        "Should show sign-in prompt after 401"
    );

    // When client navigates between /friends and /friends?handle=alice, FriendsPage keys FriendsPageContent by handle
    // Mounting the keyed component for alice renders the public view without loginRequired
    const aliceHarness = createStatefulHarness({
        handle: "alice",
        initialFriends: sampleFriends
    });
    const aliceRender = aliceHarness.render();
    assert.ok(
        !aliceRender.markup.includes("Sign in to see and manage all your travel pals"),
        "Alice's view has no sign-in prompt"
    );
    assert.ok(aliceRender.markup.includes("travelers @alice is connected with"), "Alice's travel pals are visible");
});
