import { BoardApiError, loadBoardDocument } from "./board-creator-api";
import { toPhotoBoardCard } from "./photo-board-card";
import type { GalleryBoard } from "./my-boards";

export type ProfileLibraryBoard = Pick<
    GalleryBoard,
    "compact" | "photo" | "ownership" | "href" | "editHref" | "savedByMe"
>;

// Resolve real metadata, account membership and edit permission rather than inferring them from a profile visit.
export async function loadProfileLibraryBoards(boards: readonly ProfileLibraryBoard[], signal: AbortSignal) {
    const results: PromiseSettledResult<ProfileLibraryBoard>[] = [];
    const queue = boards.map((board, index) => ({ board, index }));
    await Promise.all(
        Array.from({ length: Math.min(3, boards.length) }, async () => {
            while (queue.length) {
                const entry = queue.shift();
                if (!entry) return;
                const { board, index } = entry;
                try {
                    signal.throwIfAborted();
                    const value = await (async () => {
                        const document = await loadBoardDocument(Number(board.compact.id), signal);
                        return {
                            ...board,
                            photo: toPhotoBoardCard(document),
                            ownership: document.permissions.canManageBoard ? ("owner" as const) : ("other" as const),
                            savedByMe: document.savedByMe,
                            editHref:
                                document.permissions.canManageBoard && document.permissions.canEditContent
                                    ? `/boards/${document.boardId}/edit`
                                    : undefined
                        };
                    })();
                    results[index] = { status: "fulfilled", value };
                } catch (reason) {
                    results[index] = { status: "rejected", reason };
                }
            }
        })
    );
    return {
        boards: results.flatMap((result, index) => {
            if (result.status === "fulfilled") return [result.value];
            if (result.reason instanceof BoardApiError && [401, 403, 404].includes(result.reason.status)) return [];
            return [boards[index]];
        }),
        failed: results.some(
            (result) =>
                result.status === "rejected" &&
                !(result.reason instanceof BoardApiError && [401, 403, 404].includes(result.reason.status))
        )
    };
}
