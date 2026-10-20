import type { ImageProvider, ImagesRepository } from "./images.types.js";

export type ImageCleanup = () => Promise<void>;

export function createImageCleanup(repository: ImagesRepository, provider: ImageProvider) {
    async function cleanup(requestedOnly: boolean) {
        const before = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const candidates = await repository.listCleanupCandidates(before, 100, requestedOnly);
        let removed = 0;
        let failed = 0;
        async function remove(candidate: (typeof candidates)[number]) {
            try {
                const removeAsset = () => provider.destroy(candidate.storageKey);
                if (candidate.imageId !== null) {
                    if (await repository.cleanupImage(candidate.imageId, removeAsset)) removed += 1;
                } else if (candidate.uploadId !== null) {
                    if (await repository.cleanupIntent(candidate.uploadId, removeAsset)) removed += 1;
                }
            } catch {
                failed += 1;
                // Keep the database record and deletion request for a later retry; continue other assets.
                process.stderr.write("Image cleanup deferred: an asset could not be removed.\n");
            }
        }
        for (let start = 0; start < candidates.length; start += 4) {
            await Promise.all(candidates.slice(start, start + 4).map(remove));
        }
        return { removed, failed };
    }
    return {
        cleanupUnused: () => cleanup(false),
        async cleanupRequested() {
            try {
                while ((await cleanup(true)).removed === 100) {
                    // Drain successful batches; failed assets remain tracked for the worker.
                }
            } catch {
                // The originating change is already committed. The durable queue survives process restarts.
                process.stderr.write("Image cleanup deferred: pending deletions could not be read.\n");
            }
        }
    };
}

export function startImageCleanupWorker(cleanup: () => Promise<unknown>, intervalMs = 60_000) {
    let running = false;
    let stopped = false;
    async function run() {
        if (running || stopped) return;
        running = true;
        try {
            await cleanup();
        } catch {
            process.stderr.write("Image cleanup deferred: the maintenance sweep failed.\n");
        } finally {
            running = false;
        }
    }
    const timer = setInterval(() => void run(), intervalMs);
    timer.unref();
    void run();
    return () => {
        stopped = true;
        clearInterval(timer);
    };
}
