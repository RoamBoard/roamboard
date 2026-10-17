import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ProfileTagSelector from "../src/components/features/profile/ProfileTagSelector";

test("saved legacy interests remain visible alongside catalog tags and count toward the limit", () => {
    const html = renderToStaticMarkup(
        createElement(ProfileTagSelector, {
            selectedTags: ["Food", "Hiking"],
            onChange: () => {},
            maxTags: 2
        })
    );

    assert.match(html, /Remove Food/);
    assert.match(html, /Remove Hiking/);
    assert.match(html, /\(2\/2\)/);
    assert.match(html, /Maximum of 2 tags reached/);
});
