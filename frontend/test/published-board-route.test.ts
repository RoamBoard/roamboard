import assert from "node:assert/strict";
import test from "node:test";
import { isValidElement } from "react";
import BoardPage from "../src/app/boards/[boardId]/page";
import DatabasePublishedBoard from "../src/components/features/boards/DatabasePublishedBoard";
import { loadPublishedBoard } from "../src/lib/published-board-data";

test("a database Board route renders the live viewer with its requested ID", async () => {
    const page = await BoardPage({ params: Promise.resolve({ boardId: "718" }) });
    assert.ok(isValidElement<{ boardId: string }>(page));
    assert.equal(page.type, DatabasePublishedBoard);
    assert.equal(page.props.boardId, "718");
});

test("the retired Tokyo slug cannot render a hardcoded Board or request a database alias", async (t) => {
    const page = await BoardPage({ params: Promise.resolve({ boardId: "lost-in-tokyo" }) });
    assert.ok(isValidElement<{ boardId: string }>(page));
    assert.equal(page.type, DatabasePublishedBoard);
    assert.equal(page.props.boardId, "lost-in-tokyo");
    const originalFetch = globalThis.fetch;
    const requests: string[] = [];
    globalThis.fetch = async (input) => {
        requests.push(String(input));
        // Retired sample slugs must not be silently redirected to an account's saved Board.
        throw new Error("A retired sample slug must not request any Board");
    };
    t.after(() => {
        globalThis.fetch = originalFetch;
    });
    assert.deepEqual(await loadPublishedBoard("lost-in-tokyo"), { status: "not-found", data: null });
    assert.deepEqual(requests, []);
});
