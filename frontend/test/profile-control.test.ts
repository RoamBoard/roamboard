import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import ProfileControl from "../src/components/ui/ProfileControl";
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

test("Sidebar renders navigation links and does not render theme select", () => {
    const html = renderToStaticMarkup(
        createElement(RouterWrapper, null, createElement(Sidebar, { activeHref: "/home" }))
    );
    assert.ok(html.includes("ROAMBOARD"));
    assert.ok(html.includes('href="/home"'));
    assert.ok(html.includes('href="/discover"'));
    assert.ok(!html.includes("Color theme"));
});
