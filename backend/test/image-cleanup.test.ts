import assert from "node:assert/strict";
import test from "node:test";
import { createImageCleanup, startImageCleanupWorker } from "../src/features/images/images.cleanup.js";
import type { ImageProvider, ImagesRepository } from "../src/features/images/images.types.js";

test("a failed provider deletion stays retryable while other removed images are cleaned", async (context) => {
    context.mock.method(process.stderr, "write", () => true);
    const pending = new Map([
        [1, "old-avatar"],
        [2, "deleted-board-photo"]
    ]);
    let unavailable = true;
    const destroyed: string[] = [];
    const repository = {
        async listCleanupCandidates(_before: Date, _limit: number, requestedOnly?: boolean) {
            assert.equal(requestedOnly, true);
            return [...pending].map(([imageId, storageKey]) => ({ imageId, storageKey, uploadId: null }));
        },
        async cleanupImage(imageId: number, removeAsset: () => Promise<void>) {
            await removeAsset();
            return pending.delete(imageId);
        }
    } as ImagesRepository;
    const provider = {
        async destroy(key: string) {
            if (key === "old-avatar" && unavailable) throw new Error("Cloudinary unavailable");
            destroyed.push(key);
        }
    } as ImageProvider;
    await createImageCleanup(repository, provider).cleanupRequested();
    assert.deepEqual(destroyed, ["deleted-board-photo"]);
    assert.deepEqual([...pending.keys()], [1]);
    unavailable = false;
    await createImageCleanup(repository, provider).cleanupRequested();
    assert.equal(pending.size, 0);
    assert.deepEqual(destroyed, ["deleted-board-photo", "old-avatar"]);
});

test("cleanup worker runs on startup, retries on its interval and never overlaps sweeps", async (context) => {
    context.mock.timers.enable({ apis: ["setInterval"] });
    let calls = 0;
    let finish: (() => void) | undefined;
    const stop = startImageCleanupWorker(async () => {
        calls += 1;
        await new Promise<void>((resolve) => {
            finish = resolve;
        });
    }, 1000);
    try {
        assert.equal(calls, 1);
        context.mock.timers.tick(3000);
        assert.equal(calls, 1);
        finish!();
        await new Promise<void>((resolve) => setImmediate(resolve));
        context.mock.timers.tick(1000);
        assert.equal(calls, 2);
        finish!();
        await new Promise<void>((resolve) => setImmediate(resolve));
        stop();
        context.mock.timers.tick(5000);
        assert.equal(calls, 2);
    } finally {
        finish?.();
        stop();
    }
});
