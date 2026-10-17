import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ProfileHero from "../src/components/features/profile/ProfileHero";
import type { PublicProfile } from "../src/lib/profile";

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
