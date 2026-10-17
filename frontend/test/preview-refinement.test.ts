import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import BoardCreationPreview from "../src/components/features/boards/BoardCreationPreview";
import BoardCreator from "../src/components/features/boards/BoardCreator";
import type { BoardCreatorPayload } from "../src/types/board-creator";

function board(): BoardCreatorPayload {
    return {
        title: "A gallery afternoon",
        description: "A real description supplied by the editor.",
        status: "draft",
        visibility: "friends",
        coverImageId: null,
        tags: ["Art", "Coffee"],
        images: [],
        days: [{ id: "day-1", dayNumber: 1, date: null, pins: [] }]
    };
}

test("all preview source-edit links resolve to real targets in the production creator", () => {
    const editor = renderToStaticMarkup(createElement(BoardCreator, { initialMode: "scratch" }));
    for (const source of [board(), { ...board(), title: "", description: "", tags: [], days: [] }]) {
        const markup = renderToStaticMarkup(createElement(BoardCreationPreview, { board: source }));
        const targets = [...markup.matchAll(/href="#([^"#]+)"/g)].map((match) => match[1]);
        for (const target of ["board-title", "board-images", "board-basics", "details-discovery", "day-plan"]) {
            assert.ok(targets.includes(target), `The ${target} source must stay reachable`);
        }
        for (const target of targets)
            assert.ok(editor.includes(`id="${target}"`), `Preview link #${target} must resolve in the real editor`);
        assert.doesNotMatch(markup, /href="#undefined"|href="#null"/);
    }
});

test("the composition retains external photo attribution and source links in its full photo review", () => {
    const source: BoardCreatorPayload = {
        ...board(),
        images: [
            {
                id: "external-photo",
                pinId: null,
                publicId: "provider-photo",
                source: "unsplash",
                url: "https://photos.example.test/full.jpg",
                thumbnailUrl: "https://photos.example.test/thumb.jpg",
                width: 1200,
                height: 800,
                capturedAt: null,
                latitude: null,
                longitude: null,
                order: 0,
                credit: "Ada Photographer",
                creditUrl: "https://photos.example.test/ada",
                sourceUrl: "https://photos.example.test/source"
            }
        ]
    };
    const markup = renderToStaticMarkup(createElement(BoardCreationPreview, { board: source }));
    assert.match(markup, /Ada Photographer/);
    assert.match(markup, /src="https:\/\/photos\.example\.test\/thumb\.jpg"/);
    for (const url of ["https://photos.example.test/ada", "https://photos.example.test/source"]) {
        const link = [...markup.matchAll(/<a\b[^>]*>/g)]
            .map((match) => match[0])
            .find((tag) => tag.includes(`href="${url}"`));
        assert.ok(link, `The original photo's ${url} link must remain available`);
        assert.match(link, /target="_blank"/);
        assert.match(link, /rel="[^"]*noreferrer/);
    }
});

test("floating annotations expose only actual supported Board metadata", () => {
    const source = board();
    const markup = renderToStaticMarkup(createElement(BoardCreationPreview, { board: source }));
    const text = markup.replace(/<[^>]*>/g, "");
    assert.ok(text.includes(source.title));
    assert.ok(text.includes(source.description));
    assert.match(text, /Art/);
    assert.match(text, /Coffee/);
    assert.match(text, /Friends/);
    assert.match(text, /Drafts[\s\S]*only to you/);
    assert.doesNotMatch(text, /Highlights:|Vibes:|Saved by|by Roamboard|Tokyo|Japan/);
});
