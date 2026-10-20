import { getPool } from "../../db.js";
import type { NotificationRecord, NotificationsRepository } from "./notifications.types.js";

interface NotificationRow {
    notification_id: number;
    board_id: number;
    title: string;
    comment_id: number;
    kind: "comment" | "mention";
    body: string;
    display_name: string;
    username: string;
    profile_picture_image_id: number | null;
    created_at: Date;
    read_at: Date | null;
}

const visibleBoard = `b.status = 'published' AND (
    b.owner_user_id = $1 OR b.visibility = 'public'
    OR EXISTS (SELECT 1 FROM board_member bm WHERE bm.board_id = b.board_id AND bm.user_id = $1)
    OR (b.visibility = 'friends' AND EXISTS (
        SELECT 1 FROM friendship f WHERE f.status = 'accepted'
        AND ((f.requester_user_id = b.owner_user_id AND f.recipient_user_id = $1)
          OR (f.recipient_user_id = b.owner_user_id AND f.requester_user_id = $1))))
)`;

function mapRow(row: NotificationRow): NotificationRecord {
    return {
        notificationId: row.notification_id,
        boardId: row.board_id,
        boardTitle: row.title,
        commentId: row.comment_id,
        kind: row.kind,
        body: row.body,
        commenter: {
            displayName: row.display_name,
            username: row.username,
            profilePictureUrl:
                row.profile_picture_image_id === null
                    ? null
                    : `/api/v1/images/${row.profile_picture_image_id}/content?variant=thumbnail&profileHandle=${encodeURIComponent(row.username)}`
        },
        createdAt: row.created_at.toISOString(),
        readAt: row.read_at?.toISOString() ?? null
    };
}

export function createNotificationsRepository(): NotificationsRepository {
    return {
        async preference(boardId, userId) {
            const result = await getPool().query<{ enabled: boolean }>(
                "SELECT enabled FROM board_comment_subscription WHERE board_id = $1 AND user_id = $2",
                [boardId, userId]
            );
            return result.rows[0]?.enabled ?? null;
        },
        async setPreference(boardId, userId, enabled) {
            await getPool().query(
                `INSERT INTO board_comment_subscription (board_id, user_id, enabled) VALUES ($1, $2, $3)
                 ON CONFLICT (board_id, user_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()`,
                [boardId, userId, enabled]
            );
        },
        async list(userId, cursor, limit) {
            const result = await getPool().query<NotificationRow>(
                `SELECT n.notification_id, b.board_id, b.title, c.comment_id, c.body, n.kind,
                        u.display_name, u.username, u.profile_picture_image_id, n.created_at, n.read_at
                 FROM board_comment_notification n
                 JOIN board_comment c ON c.comment_id = n.comment_id
                 JOIN board b ON b.board_id = c.board_id
                 JOIN app_user u ON u.user_id = c.author_user_id
                 WHERE n.recipient_user_id = $1 AND ${visibleBoard}
                   AND ($2::timestamptz IS NULL OR (n.created_at, n.notification_id) < ($2::timestamptz, $3::int))
                 ORDER BY n.created_at DESC, n.notification_id DESC LIMIT $4`,
                [userId, cursor?.createdAt ?? null, cursor?.notificationId ?? null, limit]
            );
            return result.rows.map(mapRow);
        },
        async unreadCount(userId) {
            const result = await getPool().query<{ count: string }>(
                `SELECT COUNT(*)::text AS count FROM board_comment_notification n
                 JOIN board_comment c ON c.comment_id = n.comment_id
                 JOIN board b ON b.board_id = c.board_id
                 WHERE n.recipient_user_id = $1 AND n.read_at IS NULL AND ${visibleBoard}`,
                [userId]
            );
            return Number(result.rows[0]?.count ?? 0);
        },
        async markRead(userId, notificationId) {
            const result = await getPool().query<{ notification_id: number; read_at: Date }>(
                `UPDATE board_comment_notification n SET read_at = COALESCE(n.read_at, NOW())
                 FROM board_comment c JOIN board b ON b.board_id = c.board_id
                 WHERE n.comment_id = c.comment_id AND n.recipient_user_id = $1
                   AND n.notification_id = $2 AND ${visibleBoard}
                 RETURNING n.notification_id, n.read_at`,
                [userId, notificationId]
            );
            const row = result.rows[0];
            return row ? { notificationId: row.notification_id, readAt: row.read_at.toISOString() } : null;
        }
    };
}
