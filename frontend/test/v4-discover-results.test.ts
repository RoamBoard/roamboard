import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import RoamFlowGallery from "../src/components/features/discover/roamflow/RoamFlowGallery";
import DestinationStoryCard from "../src/components/features/destinations/DestinationStoryCard";
import { renderToStaticMarkup } from "react-dom/server";
import DiscoverBoardCard, { toDiscoverPhotoBoardCard } from "../src/components/features/discover/DiscoverBoardCard";
import { boardTags } from "../src/data/board-tags";
import {
    getDiscoverBoardsByDestination,
    getDiscoverBoardsByTags,
    filterBoardsByDestination,
    type DiscoverBoard
} from "../src/data/discover-boards";
import { discoveryCard } from "./fixtures/discovery-card";
import * as publicDiscover from "../src/data/discover-boards";
import FeaturedBoards from "../src/components/features/discover/FeaturedBoards";

// Materialize Node's lazy global fetch getter before node:test inspects its property descriptor.
void globalThis.fetch;

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

test("unavailable live Discover sources remain unavailable instead of substituting navigable sample Boards", async (t) => {
    t.mock.method(globalThis, "fetch", async () =>
        Response.json({ error: { message: "Unavailable" } }, { status: 503 })
    );
    for (const result of [await getDiscoverBoardsByTags([tags[0].id]), await getDiscoverBoardsByDestination("NO")]) {
        assert.equal(result.available, false);
        assert.deepEqual(result.boards, []);
    }
});

test("live Discover reads every public summary page and maps persisted tags and destination identity", async (t) => {
    const calls: URL[] = [];
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        calls.push(url);
        assert.equal(url.pathname, "/api/v1/boards/recent");
        assert.equal(init?.credentials, "omit");
        const page = Number(url.searchParams.get("page"));
        assert.ok(page === 1 || page === 2, "Pagination stops when the backend has no more results");
        return Response.json({
            data: {
                items:
                    page === 1
                        ? [discoveryCard(721, { tags: ["foodie", "Unknown retired tag"] })]
                        : [discoveryCard(721), discoveryCard(722, { tags: ["Architecture"] })],
                page,
                hasMore: page === 1
            }
        });
    });
    const result = await getDiscoverBoardsByTags(["foodie", "architecture"]);
    assert.equal(result.available, true);
    assert.deepEqual(
        result.boards.map((board) => board.id),
        ["721", "722"]
    );
    assert.deepEqual(result.boards[0].tags, ["foodie"]);
    assert.equal(result.boards[0].author, "actual_author");
    assert.deepEqual(result.boards[0].destinations, [{ country: "Japan", countryCode: "JPN", cities: ["Kyoto"] }]);
    assert.deepEqual(
        filterBoardsByDestination(result.boards, "jpn").map((board) => board.id),
        ["721", "722"]
    );
    assert.deepEqual(
        filterBoardsByDestination(result.boards, "JP").map((board) => board.id),
        ["721", "722"]
    );
    assert.deepEqual(filterBoardsByDestination(result.boards, "ZZZ"), []);
    const markup = renderToStaticMarkup(createElement(DiscoverBoardCard, { board: result.boards[0] }));
    assert.match(markup, /href="\/boards\/721"/);
    assert.match(markup, /Published Board 721/);
    assert.deepEqual(
        calls.map((url) => url.searchParams.get("page")),
        ["1", "2"]
    );
});

test("a failed later public page does not return a misleading partial Discover collection", async (t) => {
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        const page = new URL(String(input)).searchParams.get("page");
        return page === "1"
            ? Response.json({ data: { items: [discoveryCard(721)], hasMore: true } })
            : Response.json({ error: { message: "Unavailable" } }, { status: 503 });
    });
    assert.deepEqual(await getDiscoverBoardsByTags(["foodie"]), { available: false, boards: [] });
});

test("Discover Featured reads up to five public weekly summaries and retains the saved Board identity", async (t) => {
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, "/api/v1/boards/featured");
        assert.equal(url.searchParams.get("period"), "week");
        assert.equal(init?.credentials, "omit");
        return Response.json({
            data: {
                items: [740, 741, 742, 743, 744, 745].map((id) => discoveryCard(id)),
                hasMore: false
            }
        });
    });
    const load = Reflect.get(publicDiscover, "getFeaturedDiscoverBoards") as
        (() => Promise<{ available: boolean; boards: DiscoverBoard[] }>) | undefined;
    assert.ok(load);
    const result = await load();
    assert.equal(result.available, true);
    assert.deepEqual(
        result.boards.map((board) => board.id),
        ["740", "741", "742", "743", "744"]
    );
    assert.match(
        renderToStaticMarkup(createElement(DiscoverBoardCard, { board: result.boards[0] })),
        /href="\/boards\/740"/
    );
});

test("Featured displays real Board actions and preserves an honest missing-cover state", () => {
    const boards = [741, 742, 743, 744, 745].map((id) =>
        publicDiscover.fromDiscoveryCard(discoveryCard(id, { coverImageUrl: null }))
    );
    const html = renderToStaticMarkup(createElement(FeaturedBoards, { boards, available: true }));
    assert.equal(
        (html.match(/aspect-ratio:400 \/ 500/g) ?? []).length,
        5,
        "Featured uses the shared portrait Board card for every Board"
    );
    for (const id of [741, 742, 743, 744, 745]) {
        assert.ok(html.includes(`href="/boards/${id}"`));
        assert.ok(html.includes(`Published Board ${id}`));
        assert.ok(html.includes(`aria-label="View Published Board ${id}"`));
        assert.ok(
            !html.includes(`aria-label="Save Published Board ${id}"`),
            "Unknown viewer ownership must not expose a bookmark"
        );
    }
    assert.match(html, /No cover photo/);
    assert.doesNotMatch(html, /<img\b|sample|Sample traveller/);
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

test("Discover Featured and RoamFlow both resolve viewer permissions instead of assuming another author", () => {
    const source = publicDiscover.fromDiscoveryCard(discoveryCard(741));
    function cards(node: ReactNode): Array<Record<string, unknown>> {
        if (!isValidElement<{ children?: ReactNode }>(node)) return [];
        if (node.type === DestinationStoryCard) return [node.props];
        // Resolve the memoized RoamFlow item without changing the ownership assertion below.
        const memoized = node.type as { type?: (props: { children?: ReactNode }) => ReactNode };
        if (typeof memoized === "object" && typeof memoized.type === "function") {
            return cards(memoized.type(node.props));
        }
        return Children.toArray(node.props.children).flatMap(cards);
    }
    const featured = cards(FeaturedBoards({ boards: [source], available: true }));
    const captured: { tree?: ReactNode } = {};
    function Probe() {
        captured.tree = RoamFlowGallery({ boards: [{ ...toDiscoverPhotoBoardCard(source), href: source.href }] });
        return captured.tree;
    }
    const markup = renderToStaticMarkup(createElement(Probe));
    for (const presenters of [featured, cards(captured.tree)]) {
        assert.equal(presenters.length, 1);
        assert.equal(presenters[0].href, "/boards/741");
        assert.equal(presenters[0].ownership, undefined);
    }
    assert.doesNotMatch(markup, /aria-label="(?:Save |Unsave )/);
});
