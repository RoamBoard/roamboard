export type CommentNotification = {
    notificationId: number;
    boardId: number;
    boardTitle: string;
    commentId: number;
    commenter: { displayName: string; username: string; profilePictureUrl: string | null };
    excerpt: string;
    createdAt: string;
    readAt: string | null;
};

export type CommentNotificationPage = {
    data: CommentNotification[];
    meta: { nextCursor: string | null; hasMore: boolean; unreadCount: number };
};

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const listeners = new Set<() => void>();

export class CommentNotificationApiError extends Error {
    constructor(
        public status: number,
        public code: string,
        message: string
    ) {
        super(message);
    }
}

export function subscribeToCommentNotificationUpdates(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function notifyCommentNotificationUpdate(): void {
    listeners.forEach((listener) => listener());
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${apiOrigin}/api/v1${path}`, {
        ...init,
        credentials: "include",
        cache: "no-store",
        headers: init.body ? { "Content-Type": "application/json", ...init.headers } : init.headers
    });
    const payload = (await response.json().catch(() => null)) as {
        data?: T;
        meta?: CommentNotificationPage["meta"];
        error?: { code?: string; message?: string };
    } | null;
    if (!response.ok)
        throw new CommentNotificationApiError(
            response.status,
            payload?.error?.code ?? "UNKNOWN_ERROR",
            payload?.error?.message ?? "The notification request failed. Please try again."
        );
    if (!payload || payload.data === undefined)
        throw new Error("The notification response was incomplete. Please try again.");
    return payload as T;
}

export async function getCommentSubscription(boardId: string): Promise<{ enabled: boolean }> {
    const response = await apiRequest<{ data: { enabled: boolean } }>(
        `/boards/${encodeURIComponent(boardId)}/comment-subscription`
    );
    return response.data;
}

export async function setCommentSubscription(boardId: string, enabled: boolean): Promise<{ enabled: boolean }> {
    const response = await apiRequest<{ data: { enabled: boolean } }>(
        `/boards/${encodeURIComponent(boardId)}/comment-subscription`,
        { method: "PUT", body: JSON.stringify({ enabled }) }
    );
    notifyCommentNotificationUpdate();
    return response.data;
}

export async function listCommentNotifications(cursor?: string): Promise<CommentNotificationPage> {
    const path = `/users/me/comment-notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`;
    const response = await apiRequest<CommentNotificationPage>(path);
    if (!Array.isArray(response.data) || !response.meta)
        throw new Error("The notification response was incomplete. Please try again.");
    return response;
}

export async function markCommentNotificationRead(
    notificationId: number
): Promise<{ notificationId: number; readAt: string }> {
    const response = await apiRequest<{ data: { notificationId: number; readAt: string } }>(
        `/users/me/comment-notifications/${notificationId}/read`,
        { method: "POST" }
    );
    notifyCommentNotificationUpdate();
    return response.data;
}

export function commentNotificationHref(notification: Pick<CommentNotification, "boardId" | "commentId">): string {
    return `/boards/${notification.boardId}#comment-${notification.commentId}`;
}
