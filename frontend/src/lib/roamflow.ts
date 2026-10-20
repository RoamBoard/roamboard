import type { BoardCardImage, PhotoBoardCardData } from "@/types/board-card";
import { discoveryPhoto } from "./boards-discovery";
import { loadPublicBoardPage } from "./public-discover";

// Presentation and loader types only. These do not define the public Boards API contract.
export type RoamFlowBoard = PhotoBoardCardData & { image?: BoardCardImage; href?: string };
export type RoamFlowPage = { boards: readonly RoamFlowBoard[]; nextCursor: string | null };
export type RoamFlowSource = (cursor: string, signal: AbortSignal) => Promise<RoamFlowPage>;
export const roamFlowPageSize = 7;

export function appendRoamFlowBoards(current: readonly RoamFlowBoard[], incoming: readonly RoamFlowBoard[]) {
    const seen = new Set(current.map((board) => board.id));
    return [
        ...current,
        ...incoming.filter((board) => {
            if (seen.has(board.id)) return false;
            seen.add(board.id);
            return true;
        })
    ];
}

export const loadRoamFlowPage: RoamFlowSource = async (cursor, signal) => {
    signal.throwIfAborted();
    if (!/^[1-9]\d*$/.test(cursor) || Number(cursor) > 10000) throw new Error("Invalid RoamFlow page");
    const page = Number(cursor);
    const result = await loadPublicBoardPage(page, roamFlowPageSize, signal);
    signal.throwIfAborted();
    return {
        boards: result.items
            .filter((board) => board.status === "published" && board.visibility === "public")
            .map((board) => ({ ...discoveryPhoto(board), href: `/boards/${board.boardId}` })),
        nextCursor: result.hasMore ? String(page + 1) : null
    };
};
