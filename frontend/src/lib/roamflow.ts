import type { BoardCardImage, PhotoBoardCardData } from "@/types/board-card";

// Presentation and loader types only. These do not define the public Boards API contract.
export type RoamFlowBoard = PhotoBoardCardData & { image: BoardCardImage; href?: string };
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
    const { roamFlowBoards } = await import("@/data/roamflow-boards");
    signal.throwIfAborted();
    if (!/^\d+$/.test(cursor)) throw new Error("Invalid RoamFlow preview cursor");
    const offset = Number(cursor);
    const end = offset + roamFlowPageSize;
    return {
        boards: roamFlowBoards.slice(offset, end),
        nextCursor: end < roamFlowBoards.length ? String(end) : null
    };
};
