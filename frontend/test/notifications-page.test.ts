import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import NotificationsContent from "@/components/features/notifications/NotificationsContent";
import type { FriendRequest } from "@/lib/profile";

test("NotificationsContent renders empty state when signed out or no requests", () => {
    const html = renderToStaticMarkup(createElement(NotificationsContent, { initialRequests: [] }));
    assert.ok(html.includes("NOTIFICATIONS"));
    assert.ok(html.includes("Sign in to see notifications") || html.includes("All caught up!"));
});

test("NotificationsContent renders requests list with requester details and actions", () => {
    const sampleRequests: FriendRequest[] = [
        {
            requestId: 101,
            requester: {
                id: "user-101",
                username: "sammy",
                displayName: "Sammy Explorer",
                profilePictureUrl: null
            },
            status: "pending",
            createdAt: new Date().toISOString()
        }
    ];

    const html = renderToStaticMarkup(createElement(NotificationsContent, { initialRequests: sampleRequests }));
    assert.ok(html.includes("NOTIFICATIONS"));
    assert.ok(html.includes("1 pending"));
    assert.ok(html.includes("Sammy Explorer"));
    assert.ok(html.includes("@sammy"));
    assert.ok(html.includes("accept"));
    assert.ok(html.includes("reject"));
});

