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
        assert.deepEqual(destroyed, [201, 202]);
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
        assert.equal((await cleanup.cleanupUnused()).removed, 3);
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

test("all cleanup instances and the worker share two connection slots, including after responses time out", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
    const pending = new Set(Array.from({ length: 12 }, (_, index) => index + 1));
    let intentPending = true;
    let queries = 0;
    let connections = 0;
    let peakConnections = 0;
    let release!: () => void;
    const storageReady = new Promise<void>((resolve) => {
        release = resolve;
    });
    async function withConnection(remove: () => Promise<void>) {
        connections += 1;
        peakConnections = Math.max(peakConnections, connections);
        try {
            await remove();
        } finally {
            connections -= 1;
        }
    }
    const repository: Pick<ImagesRepository, "listCleanupCandidates" | "cleanupImage" | "cleanupIntent"> = {
        async listCleanupCandidates(_before, limit, requestedOnly, imageIds) {
            queries += 1;
            return [
                ...[...pending]
                    .filter((id) => !imageIds || imageIds.includes(id))
                    .map((imageId) => ({ imageId, storageKey: String(imageId), uploadId: null })),
                ...(!requestedOnly && intentPending
                    ? [{ imageId: null, storageKey: "intent", uploadId: "intent" }]
                    : [])
            ].slice(0, limit);
        },
        async cleanupImage(id, remove) {
            await withConnection(remove);
            return pending.delete(id);
        },
        async cleanupIntent(_id, remove) {
            await withConnection(remove);
            intentPending = false;
            return true;
        }
    };
    const provider = {
        async destroy() {
            await storageReady;
        }
    };
    const firstRequest = createImageCleanup(repository, provider).cleanupRequested([1, 2, 3, 4]);
    await new Promise<void>((resolve) => setImmediate(resolve));
    const stop = startImageCleanupWorker(createImageCleanup(repository, provider).cleanupUnused);
    try {
        await Promise.all([
            createImageCleanup(repository, provider).cleanupRequested([5, 6, 7, 8]),
            createImageCleanup(repository, provider).cleanupRequested([9, 10, 11, 12])
        ]);
        assert.equal(connections, 2);
        assert.equal(queries, 1, "busy cleanup must not even acquire a connection to read candidates");
        context.mock.timers.tick(1000);
        await firstRequest;
        assert.equal(connections, 2, "in-flight deletions keep their permits after the response deadline");
        await createImageCleanup(repository, provider).cleanupRequested([5, 6]);
        assert.equal(queries, 1);
        release();
        await new Promise<void>((resolve) => setImmediate(resolve));
        context.mock.timers.tick(60000);
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.equal(pending.size, 0, "the worker can retry work skipped under pressure");
        assert.equal(intentPending, false);
        assert.equal(connections, 0);
        assert.equal(peakConnections, 2);
    } finally {
        stop();
        release();
        await new Promise<void>((resolve) => setImmediate(resolve));
    }
});

test("cleanup releases shared slots when candidate queries and provider deletions fail", async (context) => {
    context.mock.method(process.stderr, "write", () => true);
    let queryFailure = true;
    let providerFailure = true;
    let deleted = 0;
    const repository: Pick<ImagesRepository, "listCleanupCandidates" | "cleanupImage" | "cleanupIntent"> = {
        async listCleanupCandidates() {
            if (queryFailure) throw new Error("Database unavailable");
            return [{ imageId: 1, storageKey: "1", uploadId: null }];
        },
        async cleanupImage(_id, remove) {
            await remove();
            deleted += 1;
            return true;
        },
        async cleanupIntent() {
            return false;
        }
    };
    const provider = {
        async destroy() {
            if (providerFailure) throw new Error("Provider unavailable");
        }
    };
    for (let attempt = 0; attempt < 3; attempt += 1) {
        await Promise.all([
            createImageCleanup(repository, provider).cleanupRequested([1]),
            createImageCleanup(repository, provider).cleanupRequested([1])
        ]);
    }
    queryFailure = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        await createImageCleanup(repository, provider).cleanupRequested([1]);
    }
    providerFailure = false;
    await createImageCleanup(repository, provider).cleanupRequested([1]);
    assert.equal(deleted, 1);
});
