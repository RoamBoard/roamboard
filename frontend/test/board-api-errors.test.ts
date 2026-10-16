import assert from "node:assert/strict";
import test from "node:test";
import { loadBoardDocument } from "../src/lib/board-creator-api";

for (const status of [401, 403, 404, 500]) {
    test(`Board reads preserve HTTP ${status} so the viewer can display the correct state`, async (t) => {
        const originalFetch = globalThis.fetch;
        t.after(() => {
            globalThis.fetch = originalFetch;
        });
        globalThis.fetch = async () =>
            Response.json({ error: { code: "READ_FAILED", message: "Board could not be read" } }, { status });
        await assert.rejects(loadBoardDocument(42), (error: unknown) => {
            assert.ok(error instanceof Error);
            assert.equal((error as Error & { status?: number }).status, status);
            assert.equal(error.message, "Board could not be read");
            return true;
        });
    });
}
