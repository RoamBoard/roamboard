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
import { editorialFallback } from "../src/lib/image-library";

test("RoamFlow starts small, pages through unique stories, and ends without looping", async () => {
    const state = { boards: [...roamFlowInitialPage.boards], cursor: roamFlowInitialPage.nextCursor, pages: 1 };
    const pageSizes = [state.boards.length];
    assert.equal(state.boards.length, 7);
    // A partial final page must end pagination instead of causing repeated requests.
    while (state.cursor !== null) {
        const page = await loadRoamFlowPage(state.cursor, new AbortController().signal);
        assert.notEqual(page.nextCursor, state.cursor);
        assert.ok(page.boards.length > 0 && page.boards.length <= 7);
        pageSizes.push(page.boards.length);
        state.boards.push(...page.boards);
        state.cursor = page.nextCursor;
        state.pages += 1;
        assert.ok(state.pages < 10, "Pagination must terminate");
    }
    assert.equal(state.pages, 4);
    assert.deepEqual(pageSizes, [7, 7, 7, 6]);
    assert.equal(state.boards.length, 27);
    assert.equal(new Set(state.boards.map((board) => board.id)).size, 27);
    assert.equal(new Set(state.boards.map((board) => board.title)).size, 27);
    assert.equal(new Set(state.boards.map((board) => board.image.src)).size, 27);
    assert.deepEqual(
        state.boards.map((board) => board.id),
        roamFlowBoards.map((board) => board.id)
    );
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

test("RoamFlow samples reference existing images and never link to fake Board details", async () => {
    await Promise.all(
        roamFlowBoards.map(async (board) => {
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
