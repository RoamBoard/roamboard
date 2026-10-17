import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ProfileAvatarEditor from "../src/components/features/settings/ProfileAvatarEditor";
import type { UserProfile } from "../src/lib/profile";

const profile: UserProfile = {
    id: "user",
    username: "traveler",
    displayName: "Traveler",
    description: "",
    location: null,
    occupation: null,
    languages: [],
    interests: [],
    profilePicture: null,
    defaultBoardVisibility: "collaborators",
    revision: 1,
    createdAt: "",
    updatedAt: ""
};

test("avatar editor offers upload and shows the default state without external URL controls", () => {
    const html = renderToStaticMarkup(createElement(ProfileAvatarEditor, { profile, onChange: () => {} }));
    assert.match(html, /Upload photo/);
    assert.match(html, /No photo/);
    assert.doesNotMatch(html, /Image URL|preset/i);
});

test("avatar editor offers removal for an uploaded photo", () => {
    const html = renderToStaticMarkup(
        createElement(ProfileAvatarEditor, {
            profile: {
                ...profile,
                profilePicture: { imageId: 12, url: "http://localhost:3001/photo", storageKey: null }
            },
            onChange: () => {}
        })
    );
    assert.match(html, /Remove photo/);
    assert.match(html, /Current profile photo/);
});
