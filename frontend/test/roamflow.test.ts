import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PhotoBoardCard from "../src/components/features/boards/cards/PhotoBoardCard";
import { photoBoardExamples } from "../src/data/board-card-examples";
import { roamFlowBoards, roamFlowInitialPage } from "../src/data/roamflow-boards";
import { appendRoamFlowBoards, loadRoamFlowPage } from "../src/lib/roamflow";

test("RoamFlow starts small, pages through unique stories, and ends without looping", async () => {
    const state = { boards: [...roamFlowInitialPage.boards], cursor: roamFlowInitialPage.nextCursor, pages: 1 };
    assert.equal(state.boards.length, 7);
    while (state.cursor !== null) {
        const page = await loadRoamFlowPage(state.cursor, new AbortController().signal);
        assert.notEqual(page.nextCursor, state.cursor);
        assert.equal(page.boards.length, 7);
        state.boards.push(...page.boards);
        state.cursor = page.nextCursor;
        state.pages += 1;
        assert.ok(state.pages < 10, "Pagination must terminate");
    }
    assert.equal(state.pages, 4);
    assert.equal(state.boards.length, 28);
    assert.equal(new Set(state.boards.map((board) => board.id)).size, 28);
    assert.equal(new Set(state.boards.map((board) => board.title)).size, 28);
    assert.equal(new Set(state.boards.map((board) => board.image.src)).size, 28);
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

test("RoamFlow supports cancellation and rejects malformed preview cursors", async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(loadRoamFlowPage("7", controller.signal), { name: "AbortError" });
    await assert.rejects(loadRoamFlowPage("invalid", new AbortController().signal));
    const last = await loadRoamFlowPage("9999", new AbortController().signal);
    assert.deepEqual(last, { boards: [], nextCursor: null });
});

test("RoamFlow references existing local images and only the implemented Board destination", async () => {
    await Promise.all(
        roamFlowBoards.map(async (board) => {
            assert.ok(board.image.src.startsWith("/"));
            await access(path.join(process.cwd(), "public", board.image.src));
            if (board.href) assert.equal(board.href, "/boards/lost-in-tokyo");
        })
    );
});

test("the shared V4 references retain their proportions, image crops, and optional navigation", () => {
    photoBoardExamples.forEach((board) => {
        const markup = renderToStaticMarkup(createElement(PhotoBoardCard, { board }));
        assert.ok(markup.includes("aspect-ratio:400 / 500"));
        assert.ok(markup.includes(board.image.src));
        assert.ok(markup.includes(board.author));
        assert.ok(!markup.includes("href="));
        if (board.image.crop) assert.ok(markup.includes(`width:${board.image.crop.width}%`));
    });
    const tokyo = roamFlowBoards.find((board) => board.id === "lost-in-tokyo");
    assert.ok(tokyo);
    const markup = renderToStaticMarkup(createElement(PhotoBoardCard, { board: tokyo, href: tokyo.href }));
    assert.ok(markup.includes('href="/boards/lost-in-tokyo"'));
    assert.ok(markup.includes('aria-label="Open Lost in Tokyo"'));
});
