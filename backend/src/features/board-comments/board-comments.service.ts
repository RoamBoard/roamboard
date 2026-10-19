import { AppError } from "../../shared/app-error.js";
import { canReadBoard, type BoardAccess, type BoardRepository } from "../boards/boards.types.js";
import type { BoardComment, CommentCursor, CommentRecord, CommentsRepository } from "./board-comments.types.js";

const pageSize = 20;

function invalidCursor(): never {
    throw new AppError(400, "Invalid comment cursor", "INVALID_REQUEST");
}

function parseCursor(value: string | undefined, boardId: number): CommentCursor | null {
    if (value === undefined) return null;
    try {
        const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
        if (!Array.isArray(decoded) || decoded.length !== 3) return invalidCursor();
        const [cursorBoardId, createdAt, commentId] = decoded;
        if (
            cursorBoardId !== boardId ||
            typeof createdAt !== "string" ||
            !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAt) ||
            !Number.isFinite(Date.parse(createdAt)) ||
            !Number.isSafeInteger(commentId) ||
            commentId <= 0
        )
            return invalidCursor();
        return { boardId, createdAt, commentId };
    } catch {
        return invalidCursor();
    }
}

function encodeCursor(record: CommentRecord): string {
    return Buffer.from(JSON.stringify([record.boardId, record.createdAt, record.commentId])).toString("base64url");
}

function present(record: CommentRecord, userId: string | null, ownerUserId: string): BoardComment {
    const { authorUserId, ...publicFields } = record;
    const canEdit = userId !== null && authorUserId === userId;
    return {
        ...publicFields,
        permissions: { canEdit, canDelete: canEdit || (userId !== null && ownerUserId === userId) }
    };
}

export function createCommentsService(boards: BoardRepository, comments: CommentsRepository) {
    async function accessibleBoard(boardId: number, userId: string | null): Promise<BoardAccess> {
        const access = await boards.getAccess(boardId, userId);
        if (!access || access.status !== "published" || !canReadBoard(access, userId))
            throw new AppError(404, "Board not found", "NOT_FOUND");
        return access;
    }

    async function existingComment(boardId: number, commentId: number): Promise<CommentRecord> {
        const comment = await comments.get(boardId, commentId);
        if (!comment) throw new AppError(404, "Comment not found", "NOT_FOUND");
        return comment;
    }

    return {
        async list(boardId: number, userId: string | null, cursorValue?: string) {
            const board = await accessibleBoard(boardId, userId);
            const cursor = parseCursor(cursorValue, boardId);
            const rows = await comments.list(boardId, cursor, pageSize + 1);
            const hasMore = rows.length > pageSize;
            const page = rows.slice(0, pageSize);
            return {
                data: page.map((row) => present(row, userId, board.ownerUserId)),
                meta: { nextCursor: hasMore ? encodeCursor(page[page.length - 1]!) : null, hasMore }
            };
        },
        async create(boardId: number, userId: string, body: string) {
            const board = await accessibleBoard(boardId, userId);
            return present(await comments.create(boardId, userId, body), userId, board.ownerUserId);
        },
        async edit(boardId: number, commentId: number, userId: string, body: string, revision: number) {
            const board = await accessibleBoard(boardId, userId);
            const current = await existingComment(boardId, commentId);
            if (current.authorUserId !== userId) throw new AppError(403, "Cannot edit this comment", "FORBIDDEN");
            if (current.revision !== revision)
                throw new AppError(409, "This comment changed. Reload it before editing.", "STALE_COMMENT");
            const updated = await comments.update(boardId, commentId, userId, revision, body);
            if (!updated) {
                const latest = await existingComment(boardId, commentId);
                if (latest.authorUserId !== userId) throw new AppError(403, "Cannot edit this comment", "FORBIDDEN");
                throw new AppError(409, "This comment changed. Reload it before editing.", "STALE_COMMENT");
            }
            return present(updated, userId, board.ownerUserId);
        },
        async delete(boardId: number, commentId: number, userId: string) {
            const board = await accessibleBoard(boardId, userId);
            const current = await existingComment(boardId, commentId);
            if (current.authorUserId !== userId && board.ownerUserId !== userId)
                throw new AppError(403, "Cannot delete this comment", "FORBIDDEN");
            if (!(await comments.delete(boardId, commentId, userId, board.ownerUserId)))
                throw new AppError(404, "Comment not found", "NOT_FOUND");
        }
    };
}
