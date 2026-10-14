import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import ProfileControl from "../src/components/ui/ProfileControl";
import {
    getMockAuthState,
    getMockAuthStateServerSnapshot,
    setMockAuthState
} from "../src/data/mock-social";

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

test("ProfileControl renders user preview menu when user prop is provided", () => {
    const html = renderToStaticMarkup(
        createElement(
            RouterWrapper,
            null,
            createElement(ProfileControl, {
                user: { name: "Test Traveler", handle: "@traveler" }
            })
        )
    );

    assert.ok(html.includes("User profile menu"));
    assert.ok(html.includes("my profile"));
});

test("ProfileControl renders login link when signed out", () => {
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

    assert.ok(html.toLowerCase().includes("log in"));
    assert.ok(html.includes('href="/login"'));
});

