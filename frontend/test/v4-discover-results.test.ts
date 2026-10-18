import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DiscoverBoardCard, { toDiscoverPhotoBoardCard } from "../src/components/features/discover/DiscoverBoardCard";
import { boardTags } from "../src/data/board-tags";
import {
    getDiscoverBoardsByDestination,
    getDiscoverBoardsByTags,
    type DiscoverBoard
} from "../src/data/discover-boards";

const tags = boardTags.slice(0, 5);
const sample: DiscoverBoard = {
    id: "an-editorial-sample",
    title: "A journey without claimed destination metadata",
    description: "The actual sample description.",
    author: "The credited sample author",
    tags: tags.map((tag) => tag.id),
    image: { url: "/images/known-editorial-photo.webp", alt: "The existing editorial cover" }
};

function cardMarkup(markup: string) {
    const cards = [...markup.matchAll(/<article\b[^>]*style="aspect-ratio:400 \/ 500"[^>]*>[\s\S]*?<\/article>/g)];
    assert.equal(cards.length, 1);
    return cards[0][0];
}

test("Discover samples use shared V4 while every genuine tag link stays outside the card action", () => {
    const markup = renderToStaticMarkup(createElement(DiscoverBoardCard, { board: sample, activeTagId: tags[1].id }));
    const card = cardMarkup(markup);
    assert.ok(card.includes(sample.title));
    assert.ok(card.includes(sample.author));
    assert.match(card, /The existing editorial cover/);
    assert.match(card, /The actual sample description/);
    assert.doesNotMatch(card, /<a\b/, "Informational metadata must not compete with the sample card disclosure");
    const cardEnd = markup.indexOf(card) + card.length;
    for (const tag of tags) {
        const expected = `href="/discover/vibes/${encodeURIComponent(tag.id)}"`;
        assert.ok(markup.indexOf(expected) > cardEnd, `${tag.name} must retain a separate visible navigation link`);
        const link = [...markup.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)]
            .map((match) => match[0])
            .find((value) => value.includes(expected));
        assert.ok(link);
        if (tag.id === tags[1].id) assert.match(link, /aria-current="page"/);
        else assert.doesNotMatch(link, /aria-current=/);
    }
    assert.equal((markup.match(/aria-current="page"/g) ?? []).length, 1);
    assert.doesNotMatch(markup, /href="\/boards\/|aria-label="(?:Save|Unsave) |\d[\d,]* saves/);
    assert.doesNotMatch(markup, /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<a\b/);
});

test("Discover never invents navigation, account state, image or destination for an incomplete sample", (t) => {
    const fetch = t.mock.method(globalThis, "fetch", async () => {
        throw new Error("Sample cards must not request account state");
    });
    const markup = renderToStaticMarkup(
        createElement(DiscoverBoardCard, { board: { ...sample, image: undefined, tags: [] } })
    );
    const card = cardMarkup(markup);
    assert.match(card, /No cover photo/);
    assert.doesNotMatch(
        card,
        /<img\b|href=|aria-pressed=|aria-label="(?:Public|Friends|Restricted access|Save|Unsave)/
    );
    assert.doesNotMatch(markup, /0 saves|Tokyo|Japan|Destination not added/);
    assert.equal(fetch.mock.callCount(), 0);
});

test("unavailable live Discover sources remain unavailable instead of substituting navigable sample Boards", async () => {
    for (const result of [await getDiscoverBoardsByTags([tags[0].id]), await getDiscoverBoardsByDestination("NO")]) {
        assert.equal(result.available, false);
        assert.deepEqual(result.boards, []);
    }
});

test("Discover V4 metadata uses supplied destinations and catalog tag names without fictional account values", () => {
    const data = toDiscoverPhotoBoardCard({
        ...sample,
        destinations: [
            { country: "Norway", countryCode: "NOR", cities: ["Bergen"] },
            { country: "Norway", countryCode: "NOR", cities: ["Oslo"] }
        ]
    });
    assert.equal(data.destination, "Bergen · Norway · Oslo");
    assert.equal(data.destinationLabel, "NOR");
    assert.deepEqual(
        data.tags,
        tags.map((tag) => tag.name)
    );
    assert.equal(data.savedCount, undefined);
    assert.equal(data.visibility, undefined);
    assert.equal(data.status, undefined);
    assert.equal(data.durationDays, undefined);
});
