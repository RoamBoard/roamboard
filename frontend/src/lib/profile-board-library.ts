import { BoardApiError, loadBoardDocument } from "./board-creator-api";
import { toPhotoBoardCard } from "./photo-board-card";
import type { GalleryBoard } from "./my-boards";

export type ProfileLibraryBoard = Pick<
    GalleryBoard,
    "compact" | "photo" | "ownership" | "href" | "editHref" | "savedByMe"
>;

// Resolve real metadata, account membership and edit permission rather than inferring them from a profile visit.
export async function loadProfileLibraryBoards(boards: readonly ProfileLibraryBoard[], signal: AbortSignal) {
    const results = await Promise.allSettled(
        boards.map(async (board) => {
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
