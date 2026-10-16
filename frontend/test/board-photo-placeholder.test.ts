import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BoardPhoto from "../src/components/features/boards/BoardPhoto";

test("a missing automatic photo keeps its space with an accessible location placeholder", () => {
    const markup = renderToStaticMarkup(
        createElement(BoardPhoto, { placeholderLabel: "Tokyo", className: "aspect-[1.8]" })
    );
    assert.match(markup, /Tokyo/);
    assert.match(markup, /role="img"/);
    assert.match(markup, /aspect-\[1\.8\]/);
    assert.doesNotMatch(markup, /<img/);
});

test("an absent author photo is still omitted when no placeholder was requested", () => {
    assert.equal(renderToStaticMarkup(createElement(BoardPhoto)), "");
});

test("automatic photos display photographer credit with Unsplash referral links", () => {
    const markup = renderToStaticMarkup(
        createElement(BoardPhoto, {
            image: {
                id: "unsplash-station",
                url: "https://images.unsplash.com/photo-station",
                alt: "Tokyo station",
                source: "application",
                photographer: "Ada Rail",
                photographerUrl: "https://unsplash.com/@adarail",
                sourceUrl: "https://unsplash.com/photos/station"
            },
            showCredit: true
        })
    );
    assert.match(markup, /Photo by/);
    assert.match(markup, /Ada Rail/);
    assert.match(markup, /utm_source=roamboard/);
    assert.match(markup, /utm_medium=referral/);
});
