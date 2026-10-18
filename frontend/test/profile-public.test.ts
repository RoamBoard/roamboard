import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ProfileHero from "../src/components/features/profile/ProfileHero";
import type { PublicProfile, ProfileStats } from "../src/lib/profile";

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
