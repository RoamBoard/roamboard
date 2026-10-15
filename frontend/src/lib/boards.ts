import { loadBoardDocument, type BoardDocument } from "@/lib/board-creator-api";

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type SavedBoardSummary = {
    boardId: number;
    ownerId: string;
    title: string;
    visibility: "collaborators" | "friends" | "public";
    status: "draft" | "published";
    updatedAt: string;
    coverImageUrl: string | null;
};
export type SavedBoardRecord = BoardDocument;
export const loadSavedBoard = (boardId: number) => loadBoardDocument(boardId);

export async function listBoards(page = 1): Promise<{
    data: SavedBoardSummary[];
    meta: { page: number; limit: number; hasMore: boolean };
}> {
    const response = await fetch(`${apiOrigin}/api/v1/dev/boards?page=${page}&limit=20`, {
        cache: "no-store",
        credentials: "include"
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? "Boards could not be loaded.");
    return body;
}

export async function deleteBoard(boardId: number): Promise<void> {
    const response = await fetch(`${apiOrigin}/api/v1/boards/${boardId}`, {
        method: "DELETE",
        credentials: "include"
    });
    if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error?.message ?? "The Board could not be deleted.");
    }
}
