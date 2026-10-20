import type { ImageProvider, ImagesRepository } from "./images.types.js";
import type { BoardDocument } from "../boards/boards.types.js";

export type ImageCleanup = (imageIds: readonly number[]) => Promise<void>;

export function boardImageIds(board: BoardDocument | null): number[] {
    if (!board) return [];
    return [
        ...new Set(
            [
                ...board.images.map((image) => image.imageId),
                board.coverImageId,
                ...board.days.flatMap((day) =>
                    day.activities.flatMap((activity) => [...activity.uploadedImageIds, activity.coverImageId])
                )
            ].filter((id): id is number => id !== null && id !== undefined)
        )
    ];
}

export function createImageCleanup(
    repository: Pick<ImagesRepository, "listCleanupCandidates" | "cleanupImage" | "cleanupIntent">,
    provider: Pick<ImageProvider, "destroy">
) {
    async function cleanup(requestedOnly: boolean, imageIds?: readonly number[], expired = () => false) {
        const before = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const candidates = await repository.listCleanupCandidates(
            before,
            imageIds?.length ?? 100,
            requestedOnly,
            imageIds
        );
        let removed = 0;
        let failed = 0;
        async function remove(candidate: (typeof candidates)[number]) {
            if (expired()) return;
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
        async cleanupRequested(imageIds: readonly number[]) {
            const scopedIds = [...new Set(imageIds)].slice(0, 4);
            if (!scopedIds.length) return;
            let expired = false;
            let timer: ReturnType<typeof setTimeout> | undefined;
            const deadline = new Promise<void>((resolve) => {
                timer = setTimeout(() => {
                    expired = true;
                    resolve();
                }, 1000);
            });
            try {
                // An in-flight scoped deletion may finish after the deadline. Other work stays in the worker queue.
                await Promise.race([cleanup(true, scopedIds, () => expired), deadline]);
            } catch {
                // The originating change is already committed. The durable queue survives process restarts.
                process.stderr.write("Image cleanup deferred: pending deletions could not be read.\n");
            } finally {
                clearTimeout(timer);
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
