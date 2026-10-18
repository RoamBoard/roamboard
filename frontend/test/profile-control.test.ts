import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import ProfileControl from "../src/components/ui/ProfileControl";
import NotificationControl from "../src/components/ui/NotificationControl";
import Sidebar from "../src/components/layout/Sidebar";
import { getMockAuthState, getMockAuthStateServerSnapshot, setMockAuthState } from "../src/data/mock-social";

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

test("mock auth defaults to signed out and updates via setMockAuthState", () => {
    setMockAuthState(false);
    assert.equal(getMockAuthState(), false);
    assert.equal(getMockAuthStateServerSnapshot(), false);

    setMockAuthState(true);
    assert.equal(getMockAuthState(), true);
    assert.equal(getMockAuthStateServerSnapshot(), false);

    // Reset back
    setMockAuthState(false);
});

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
    setMockAuthState(false);
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
        createElement(NotificationControl, {
            sidebar: true,
            iconOnly: false,
            open: false,
            initialRequests: requests
        })
    );
    assert.ok(closedHtml.includes("Notifications"));
    assert.ok(closedHtml.includes("notifications"));
    assert.ok(closedHtml.includes("1 pending requests"));
    assert.ok(!closedHtml.includes("Alice Wonderland"));

    const openHtml = renderToStaticMarkup(
        createElement(NotificationControl, {
            sidebar: true,
            iconOnly: false,
            open: true,
            initialRequests: requests
        })
    );
    assert.ok(openHtml.includes("notifications"));
    assert.ok(openHtml.includes("view all"));
    assert.ok(openHtml.includes("Alice Wonderland"));
    assert.ok(openHtml.includes("@alice"));
    assert.ok(openHtml.includes("accept"));
    assert.ok(openHtml.includes("reject"));
});

test("Sidebar renders navigation links including labs, and notification menu above profile control", () => {
    const html = renderToStaticMarkup(
        createElement(RouterWrapper, null, createElement(Sidebar, { activeHref: "/home" }))
    );
    assert.ok(html.includes("ROAMBOARD"));
    assert.ok(html.includes('href="/home"'));
    assert.ok(html.includes('href="/discover"'));
    assert.ok(html.includes('href="/dev/providers"'));
    assert.ok(html.includes("labs"));
    assert.ok(html.includes("Notifications"));
    assert.ok(html.includes("Account menu"));

    // Notification menu appears before account menu in DOM order (above it)
    const notifIdx = html.indexOf('aria-label="Notifications"');
    const accountIdx = html.indexOf('aria-label="Account menu"');
    assert.ok(notifIdx !== -1 && accountIdx !== -1 && notifIdx < accountIdx);
});
