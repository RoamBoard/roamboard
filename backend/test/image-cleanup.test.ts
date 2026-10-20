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
    await createImageCleanup(repository, provider).cleanupRequested([1, 2]);
    assert.deepEqual(destroyed, ["deleted-board-photo"]);
    assert.deepEqual([...pending.keys()], [1]);
    unavailable = false;
    await createImageCleanup(repository, provider).cleanupRequested([1]);
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

test("request cleanup is scoped, caps work at four images and returns after one second despite a slow provider", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const pending = new Set([...Array.from({ length: 100 }, (_, index) => index + 1), 201, 202, 203, 204, 205]);
    const destroyed: number[] = [];
    let release!: () => void;
    const providerReady = new Promise<void>((resolve) => {
        release = resolve;
    });
    const repository = {
        async listCleanupCandidates(
            _before: Date,
            limit: number,
            requestedOnly?: boolean,
            imageIds?: readonly number[]
        ) {
            if (requestedOnly) {
                assert.equal(limit, 4);
                assert.deepEqual(imageIds, [201, 202, 203, 204]);
            }
            return [...pending]
                .filter((id) => !imageIds || imageIds.includes(id))
                .slice(0, limit)
                .map((imageId) => ({ imageId, storageKey: String(imageId), uploadId: null }));
        },
        async cleanupImage(id: number, remove: () => Promise<void>) {
            await remove();
            return pending.delete(id);
        }
    } as ImagesRepository;
    const provider = {
        async destroy(key: string) {
            destroyed.push(Number(key));
            await providerReady;
        }
    } as ImageProvider;
    const cleanup = createImageCleanup(repository, provider);
    let returned = false;
    const immediate = cleanup.cleanupRequested([201, 202, 203, 204, 205]).then(() => {
        returned = true;
    });
    try {
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.deepEqual(destroyed, [201, 202, 203, 204]);
        context.mock.timers.tick(999);
        await Promise.resolve();
        assert.equal(returned, false);
        context.mock.timers.tick(1);
        await immediate;
        assert.equal(returned, true);
        assert.equal(pending.size, 105, "the stalled provider does not delay the response");
        release();
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.equal(pending.has(205), true, "remaining affected images stay queued");
        assert.ok(Array.from({ length: 100 }, (_, index) => index + 1).every((id) => pending.has(id)));
        assert.equal((await cleanup.cleanupUnused()).removed, 100, "the worker processes the unrelated queue");
        assert.equal((await cleanup.cleanupUnused()).removed, 1);
        assert.equal(pending.size, 0);
    } finally {
        release();
    }
});

test("request deadline also covers the queue query and prevents late queries starting provider work", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    let release!: () => void;
    const queryReady = new Promise<void>((resolve) => {
        release = resolve;
    });
    let deletions = 0;
    const cleanup = createImageCleanup(
        {
            async listCleanupCandidates() {
                await queryReady;
                return [{ imageId: 1, storageKey: "1", uploadId: null }];
            },
            async cleanupImage(_id: number, remove: () => Promise<void>) {
                await remove();
                return true;
            },
            async cleanupIntent() {
                return false;
            }
        },
        {
            async destroy() {
                deletions += 1;
            }
        }
    );
    const immediate = cleanup.cleanupRequested([1]);
    context.mock.timers.tick(1000);
    await immediate;
    release();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(deletions, 0);
});
