import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ProfileAvatarEditor, { validateAvatarUrl } from "../src/components/features/settings/ProfileAvatarEditor";

test("validateAvatarUrl accepts empty string and valid Unsplash URLs", () => {
    assert.deepEqual(validateAvatarUrl("library:frontend.images.boards.author"), {
        isValid: true,
        normalizedUrl: "library:frontend.images.boards.author"
    });
    assert.deepEqual(validateAvatarUrl(""), {
        isValid: true,
        normalizedUrl: ""
    });
    assert.deepEqual(validateAvatarUrl("   "), {
        isValid: true,
        normalizedUrl: ""
    });

    const validUnsplash =
        "https://images.unsplash.com/photo-1769786186317-272d062fcf93?auto=format&fit=crop&w=400&q=80";
    const res = validateAvatarUrl(validUnsplash);
    assert.equal(res.isValid, true);
    assert.equal(res.normalizedUrl, validUnsplash);

    const relativePath = "/avatars/default.png";
    const relRes = validateAvatarUrl(relativePath);
    assert.equal(relRes.isValid, true);
    assert.equal(relRes.normalizedUrl, relativePath);
});

test("validateAvatarUrl rejects incomplete strings and unsupported hosts", () => {
    // Typing single characters or incomplete schemes
    assert.equal(validateAvatarUrl("h").isValid, false);
    assert.equal(validateAvatarUrl("ht").isValid, false);
    assert.equal(validateAvatarUrl("https://").isValid, false);

    // Unsupported host outside Next.js configured remotePatterns
    const unsupported = validateAvatarUrl("https://example.com/profile.jpg");
    assert.equal(unsupported.isValid, false);
    assert.match(unsupported.error ?? "", /Host not supported/);

    // Insecure HTTP rejected
    const httpUrl = validateAvatarUrl("http://images.unsplash.com/photo-1769786186317-272d062fcf93");
    assert.equal(httpUrl.isValid, false);
    assert.match(httpUrl.error ?? "", /https:\/\//);

    // Protocol-relative URLs rejected
    const protocolRelative = validateAvatarUrl("//images.unsplash.com/photo.jpg");
    assert.equal(protocolRelative.isValid, false);
    assert.match(protocolRelative.error ?? "", /Protocol-relative/);
});

test("ProfileAvatarEditor renders fallback safely without crashing when avatarUrl is unfinished text", () => {
    // This previously crashed Next.js <Image> with an unhandled exception when typing 'h'
    assert.doesNotThrow(() => {
        const html = renderToStaticMarkup(
            createElement(ProfileAvatarEditor, {
                avatarUrl: "h",
                onChangeAvatarUrl: () => {}
            })
        );
        assert.ok(html.includes("Invalid URL"));
        assert.ok(!html.includes('src="h"'));
    });
});

test("ProfileAvatarEditor renders Image tag when avatarUrl is a valid Unsplash URL", () => {
    const validUrl = "https://images.unsplash.com/photo-1769786186317-272d062fcf93?auto=format&fit=crop&w=400&q=80";
    const html = renderToStaticMarkup(
        createElement(ProfileAvatarEditor, {
            avatarUrl: validUrl,
            onChangeAvatarUrl: () => {}
        })
    );
    assert.ok(html.includes("Current profile preview"));
});
