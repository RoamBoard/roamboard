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
