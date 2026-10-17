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
const writeControls = { disabled: false, onBeginChange: () => true, onEndChange: () => {} };

test("avatar editor offers upload and shows the default state without external URL controls", () => {
    const html = renderToStaticMarkup(
        createElement(ProfileAvatarEditor, { profile, onChange: () => {}, ...writeControls })
    );
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
            onChange: () => {},
            ...writeControls
        })
    );
    assert.match(html, /Remove photo/);
    assert.match(html, /Current profile photo/);
});

test("avatar controls are disabled during another profile write", () => {
    const html = renderToStaticMarkup(
        createElement(ProfileAvatarEditor, {
            profile: {
                ...profile,
                profilePicture: { imageId: 12, url: "http://localhost:3001/photo", storageKey: null }
            },
            onChange: () => {},
            ...writeControls,
            disabled: true
        })
    );
    assert.match(html, /<input[^>]*disabled=""/);
    assert.match(html, /<button[^>]*disabled=""[^>]*>Remove photo/);
});
