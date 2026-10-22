import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PhotoBoardCard from "../src/components/features/boards/cards/PhotoBoardCard";
import { photoBoardExamples } from "../src/data/board-card-examples";
import { roamFlowBoards } from "../src/data/roamflow-boards";
import { appendRoamFlowBoards, loadRoamFlowPage } from "../src/lib/roamflow";
import { editorialFallback } from "../src/lib/image-library";
import { discoveryCard } from "./fixtures/discovery-card";
import RoamFlow from "../src/components/features/discover/roamflow/RoamFlow";

void globalThis.fetch;

test("RoamFlow keeps loaded Boards in one list without chapter headings or a continue prompt", () => {
    const boards = Array.from({ length: 15 }, (_, index) => ({
        ...roamFlowBoards[index % roamFlowBoards.length],
        id: `story-${index + 1}`
    }));
    const markup = renderToStaticMarkup(
        createElement(RoamFlow, { initialPage: { boards, nextCursor: "3" }, reduceMotion: true })
    );
    assert.equal((markup.match(/<ol\b/g) ?? []).length, 1);
    assert.equal((markup.match(/id="roamflow-story-/g) ?? []).length, boards.length);
    assert.match(markup, /aria-label="Travel stories"/);
    assert.match(markup, /Roam with the flow/);
    assert.match(markup, /Just keep scrolling\./);
    assert.match(markup, /href="#roamflow"[^>]*>Back to RoamFlow/);
    assert.doesNotMatch(markup, /Skip gallery/);
    assert.doesNotMatch(
        markup,
        /Take the longer way|Somewhere you haven.t been|Keep exploring|Continue to page footer/
    );
});

test("RoamFlow pages public published summaries and retains Boards without covers", async (t) => {
    const signal = new AbortController().signal;
    const calls: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        calls.push(url.searchParams.get("page")!);
        assert.equal(url.pathname, "/api/v1/boards/recent");
        assert.equal(url.searchParams.get("limit"), "7");
        assert.equal(init?.credentials, "omit");
        assert.equal(init?.signal, signal);
        return Response.json({
            data: {
                items: [discoveryCard(url.searchParams.get("page") === "2" ? 721 : 722, { coverImageUrl: null })],
                hasMore: url.searchParams.get("page") === "2"
            }
        });
    });
    const second = await loadRoamFlowPage("2", signal);
    assert.deepEqual(
        second.boards.map((board) => board.id),
        ["721"]
    );
    assert.equal(second.boards[0].href, "/boards/721");
    assert.equal(second.boards[0].image, undefined);
    assert.equal(second.nextCursor, "3");
    const last = await loadRoamFlowPage(second.nextCursor!, signal);
    assert.equal(last.nextCursor, null);
    assert.deepEqual(calls, ["2", "3"]);
});

test("RoamFlow preserves identity and order when pages overlap or contain duplicates", () => {
    const [first, second, third] = roamFlowBoards;
    const result = appendRoamFlowBoards([first], [first, second, second, third]);
    assert.deepEqual(result, [first, second, third]);
    assert.equal(result[0], first);
    assert.equal(
        appendRoamFlowBoards(
            [],
            Array.from({ length: 1000 }, () => first)
        ).length,
        1
    );
});

test("RoamFlow supports cancellation and rejects malformed page cursors", async (t) => {
    const call = t.mock.method(globalThis, "fetch", async () => Response.json({ data: { items: [], hasMore: false } }));
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(loadRoamFlowPage("7", controller.signal), { name: "AbortError" });
    await assert.rejects(loadRoamFlowPage("invalid", new AbortController().signal));
    assert.equal(call.mock.callCount(), 0);
    const last = await loadRoamFlowPage("9999", new AbortController().signal);
    assert.deepEqual(last, { boards: [], nextCursor: null });
});

test("RoamFlow provider failure rejects without substituting sample stories", async (t) => {
    t.mock.method(globalThis, "fetch", async () =>
        Response.json({ error: { message: "Unavailable" } }, { status: 503 })
    );
    await assert.rejects(loadRoamFlowPage("2", new AbortController().signal));
});

test("RoamFlow samples reference existing images and never link to fake Board details", async () => {
    await Promise.all(
        roamFlowBoards.map(async (board) => {
            assert.ok(board.image);
            assert.ok(board.image.src.startsWith("library:"));
            const fallback = editorialFallback(board.image.src);
            assert.ok(fallback);
            await access(path.join(process.cwd(), "public", fallback));
            assert.equal(board.href, undefined);
            const markup = renderToStaticMarkup(createElement(PhotoBoardCard, { board, href: board.href }));
            assert.doesNotMatch(markup, /href=/);
        })
    );
});

test("the shared V4 references retain their proportions, image crops, and optional navigation", () => {
    photoBoardExamples.forEach((board) => {
        const markup = renderToStaticMarkup(createElement(PhotoBoardCard, { board }));
        assert.ok(markup.includes("aspect-ratio:400 / 500"));
        assert.ok(markup.includes(editorialFallback(board.image.src)!));
        assert.ok(markup.includes(board.author));
        assert.ok(!markup.includes("href="));
        if (board.image.crop) assert.ok(markup.includes(`width:${board.image.crop.width}%`));
    });
    const linked = photoBoardExamples[0];
    const markup = renderToStaticMarkup(createElement(PhotoBoardCard, { board: linked, href: "/boards/718" }));
    assert.ok(markup.includes('href="/boards/718"'));
    assert.ok(markup.includes(`aria-label="Open ${linked.title}"`));
});
