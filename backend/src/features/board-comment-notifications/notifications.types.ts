export interface NotificationRecord {
    notificationId: number;
    boardId: number;
    boardTitle: string;
    commentId: number;
    body: string;
    kind: "comment" | "mention";
    commenter: { displayName: string; username: string; profilePictureUrl: string | null };
    createdAt: string;
    readAt: string | null;
}

export type CommentNotification = Omit<NotificationRecord, "body"> & { excerpt: string };

export interface NotificationCursor {
    createdAt: string;
    notificationId: number;
}

export interface NotificationsRepository {
    preference(boardId: number, userId: string): Promise<boolean | null>;
    setPreference(boardId: number, userId: string, enabled: boolean): Promise<void>;
    list(userId: string, cursor: NotificationCursor | null, limit: number): Promise<NotificationRecord[]>;
    unreadCount(userId: string): Promise<number>;
    markRead(userId: string, notificationId: number): Promise<{ notificationId: number; readAt: string } | null>;
}
