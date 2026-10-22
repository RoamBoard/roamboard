import { createHash } from "node:crypto";

import { AppError } from "../../shared/app-error.js";
import { canReadBoard, type BoardRepository } from "../boards/boards.types.js";
import type {
    CommentNotification,
    NotificationCursor,
    NotificationRecord,
    NotificationsRepository
} from "./notifications.types.js";

const pageSize = 20;

function cursorKey(userId: string): string {
    return createHash("sha256").update(userId).digest("hex").slice(0, 16);
}

function invalidCursor(): never {
    throw new AppError(400, "Invalid notification cursor", "INVALID_REQUEST");
}

function decodeCursor(value: string | undefined, userId: string): NotificationCursor | null {
    if (value === undefined) return null;
    try {
        const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
        if (!Array.isArray(decoded) || decoded.length !== 3) return invalidCursor();
        const [key, createdAt, notificationId] = decoded;
        if (
            key !== cursorKey(userId) ||
            typeof createdAt !== "string" ||
            !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAt) ||
            !Number.isFinite(Date.parse(createdAt)) ||
            !Number.isSafeInteger(notificationId) ||
            notificationId <= 0
        )
            return invalidCursor();
        return { createdAt, notificationId };
    } catch {
        return invalidCursor();
    }
}

function encodeCursor(userId: string, record: NotificationRecord): string {
    return Buffer.from(JSON.stringify([cursorKey(userId), record.createdAt, record.notificationId])).toString(
        "base64url"
    );
}

function present(record: NotificationRecord): CommentNotification {
    const { body, ...fields } = record;
    return { ...fields, excerpt: Array.from(body.replace(/\s+/g, " ").trim()).slice(0, 140).join("") };
}

export function createNotificationsService(boards: BoardRepository, notifications: NotificationsRepository) {
    async function accessibleBoard(boardId: number, userId: string) {
        const board = await boards.getAccess(boardId, userId);
        if (!board || board.status !== "published" || !canReadBoard(board, userId))
            throw new AppError(404, "Board not found", "NOT_FOUND");
        return board;
    }

    return {
        async subscription(boardId: number, userId: string) {
            const board = await accessibleBoard(boardId, userId);
            const preference = await notifications.preference(boardId, userId);
            return { enabled: preference ?? board.ownerUserId === userId };
        },
        async setSubscription(boardId: number, userId: string, enabled: boolean) {
            await accessibleBoard(boardId, userId);
            await notifications.setPreference(boardId, userId, enabled);
            return { enabled };
        },
        async list(userId: string, cursorValue?: string, unreadOnly = false) {
            const cursor = decodeCursor(cursorValue, userId);
            const [rows, unreadCount] = await Promise.all([
                notifications.list(userId, cursor, pageSize + 1, unreadOnly),
                notifications.unreadCount(userId)
            ]);
            const hasMore = rows.length > pageSize;
            const page = rows.slice(0, pageSize);
            return {
                data: page.map(present),
                meta: {
                    nextCursor: hasMore ? encodeCursor(userId, page[page.length - 1]!) : null,
                    hasMore,
                    unreadCount
                }
            };
        },
        async markRead(userId: string, notificationId: number) {
            const read = await notifications.markRead(userId, notificationId);
            if (!read) throw new AppError(404, "Notification not found", "NOT_FOUND");
            return read;
        },
        async markAllRead(userId: string) {
            await notifications.markAllRead(userId);
            return { unreadCount: await notifications.unreadCount(userId) };
        }
    };
}
