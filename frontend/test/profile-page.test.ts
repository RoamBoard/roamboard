import test from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import ProfilePageContent from "@/components/features/profile/ProfilePageContent";

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

test("ProfilePageContent renders ACCOUNT and PROFILE header without audience tabs", () => {
    const html = renderToStaticMarkup(createElement(RouterWrapper, null, createElement(ProfilePageContent)));
    assert.ok(html.includes("ACCOUNT"));
    assert.ok(html.includes("PROFILE"));
    assert.ok(!html.includes("Audience filter"));
    assert.ok(!html.includes("EXPLORE"));
});
