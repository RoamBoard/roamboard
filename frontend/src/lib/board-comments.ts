export type BoardComment = {
    commentId: number;
    boardId: number;
    body: string;
    mentions: { handle: string; username: string }[];
    author: { displayName: string; username: string; profilePictureUrl: string | null };
    createdAt: string;
    editedAt: string | null;
    revision: number;
    permissions: { canEdit: boolean; canDelete: boolean };
};

export type BoardCommentPage = {
    data: BoardComment[];
    meta: { nextCursor: string | null; hasMore: boolean };
};

export const boardCommentLimit = 2000;
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class BoardCommentApiError extends Error {
    constructor(
        public status: number,
        public code: string,
        message: string
    ) {
        super(message);
    }
}

export function commentLength(value: string): number {
    return Array.from(value).length;
}

export function limitCommentLength(value: string): string {
    return Array.from(value).slice(0, boardCommentLimit).join("");
}

function commentPath(boardId: string, commentId?: number): string {
    return `/api/v1/boards/${encodeURIComponent(boardId)}/comments${commentId === undefined ? "" : `/${commentId}`}`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<{ data: T; meta?: BoardCommentPage["meta"] }> {
    const response = await fetch(`${apiOrigin}${path}`, {
        ...init,
        credentials: "include",
        cache: "no-store",
        headers: init.body ? { "Content-Type": "application/json", ...init.headers } : init.headers
    }).catch(() => {
        throw new Error("Could not reach Roamboard. Please try again.");
    });
    if (response.status === 204) return { data: undefined as T };
    const payload = (await response.json().catch(() => null)) as {
        data?: T;
        meta?: BoardCommentPage["meta"];
        error?: { code?: string; message?: string };
    } | null;
    if (!response.ok) {
        throw new BoardCommentApiError(
            response.status,
            payload?.error?.code ?? "UNKNOWN_ERROR",
            payload?.error?.message ?? "The comment request failed. Please try again."
        );
    }
    if (!payload || payload.data === undefined)
        throw new Error("The comment response was incomplete. Please try again.");
    return { data: payload.data, meta: payload.meta };
}

export async function listBoardComments(boardId: string, cursor?: string): Promise<BoardCommentPage> {
    const path = `${commentPath(boardId)}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`;
    const payload = await request<BoardComment[]>(path);
    if (!payload.meta || !Array.isArray(payload.data))
        throw new Error("The comment response was incomplete. Please try again.");
    return { data: payload.data, meta: payload.meta };
}

export async function postBoardComment(boardId: string, body: string): Promise<BoardComment> {
    const payload = await request<BoardComment>(commentPath(boardId), {
        method: "POST",
        body: JSON.stringify({ body })
    });
    return payload.data;
}

export async function editBoardComment(
    boardId: string,
    commentId: number,
    body: string,
    revision: number
): Promise<BoardComment> {
    const payload = await request<BoardComment>(commentPath(boardId, commentId), {
        method: "PATCH",
        body: JSON.stringify({ body, revision })
    });
    return payload.data;
}

export async function deleteBoardComment(boardId: string, commentId: number): Promise<void> {
    await request<void>(commentPath(boardId, commentId), { method: "DELETE" });
}

// The contract has no single-comment endpoint. A conflict reload walks cursor pages until it finds the current row.
export async function reloadBoardComment(
    boardId: string,
    commentId: number,
    cursor?: string
): Promise<BoardComment | null> {
    const page = await listBoardComments(boardId, cursor);
    const comment = page.data.find((item) => item.commentId === commentId);
    if (comment || !page.meta.nextCursor) return comment ?? null;
    return reloadBoardComment(boardId, commentId, page.meta.nextCursor);
}
