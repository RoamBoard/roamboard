import { getPool } from "../../db.js";
import { AppError } from "../../shared/app-error.js";
import type { CommentCursor, CommentRecord, CommentsRepository } from "./board-comments.types.js";

interface CommentRow {
    comment_id: number;
    board_id: number;
    author_user_id: string;
    body: string;
    created_at: Date;
    edited_at: Date | null;
    revision: number;
    display_name: string;
    username: string;
    profile_picture_image_id: number | null;
}

const fields = `c.comment_id, c.board_id, c.author_user_id, c.body, c.created_at, c.edited_at, c.revision,
                u.display_name, u.username, u.profile_picture_image_id`;

function mapComment(row: CommentRow): CommentRecord {
    return {
        commentId: row.comment_id,
        boardId: row.board_id,
        authorUserId: row.author_user_id,
        body: row.body,
        createdAt: row.created_at.toISOString(),
        editedAt: row.edited_at?.toISOString() ?? null,
        revision: row.revision,
        author: {
            displayName: row.display_name,
            username: row.username,
            profilePictureUrl:
                row.profile_picture_image_id === null
                    ? null
                    : `/api/v1/images/${row.profile_picture_image_id}/content?variant=thumbnail&profileHandle=${encodeURIComponent(row.username)}`
        }
    };
}

export function createCommentsRepository(): CommentsRepository {
    return {
        async list(boardId, cursor: CommentCursor | null, limit) {
            const result = await getPool().query<CommentRow>(
                `SELECT ${fields}
                 FROM board_comment c JOIN app_user u ON u.user_id = c.author_user_id
                 WHERE c.board_id = $1
                   AND ($2::timestamptz IS NULL OR (c.created_at, c.comment_id) < ($2::timestamptz, $3::int))
                 ORDER BY c.created_at DESC, c.comment_id DESC LIMIT $4`,
                [boardId, cursor?.createdAt ?? null, cursor?.commentId ?? null, limit]
            );
            return result.rows.map(mapComment);
        },
        async get(boardId, commentId) {
            const result = await getPool().query<CommentRow>(
                `SELECT ${fields} FROM board_comment c JOIN app_user u ON u.user_id = c.author_user_id
                 WHERE c.board_id = $1 AND c.comment_id = $2`,
                [boardId, commentId]
            );
            return result.rows[0] ? mapComment(result.rows[0]) : null;
        },
        async create(boardId, authorUserId, body) {
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                const board = await client.query(
                    "SELECT board_id FROM board WHERE board_id = $1 AND status = 'published' FOR SHARE",
                    [boardId]
                );
                if (board.rowCount !== 1) throw new AppError(404, "Board not found", "NOT_FOUND");
                const result = await client.query<CommentRow>(
                    `WITH inserted AS (
                        INSERT INTO board_comment (board_id, author_user_id, body) VALUES ($1, $2, $3) RETURNING *
                     ) SELECT ${fields} FROM inserted c JOIN app_user u ON u.user_id = c.author_user_id`,
                    [boardId, authorUserId, body]
                );
                const comment = mapComment(result.rows[0]!);
                await client.query(
                    `INSERT INTO board_comment_subscription (board_id, user_id, enabled)
                     VALUES ($1, $2, TRUE) ON CONFLICT (board_id, user_id) DO NOTHING`,
                    [boardId, authorUserId]
                );
                await client.query(
                    `INSERT INTO board_comment_notification (comment_id, recipient_user_id)
                     SELECT $3, recipients.user_id FROM board b
                     CROSS JOIN LATERAL (
                         SELECT b.owner_user_id AS user_id
                         WHERE b.owner_user_id <> $2
                           AND COALESCE((SELECT s.enabled FROM board_comment_subscription s
                                         WHERE s.board_id = b.board_id AND s.user_id = b.owner_user_id), TRUE)
                         UNION
                         SELECT s.user_id FROM board_comment_subscription s
                         WHERE s.board_id = b.board_id AND s.enabled AND s.user_id <> $2
                           AND (s.user_id = b.owner_user_id OR b.visibility = 'public'
                                OR EXISTS (SELECT 1 FROM board_member bm
                                           WHERE bm.board_id = b.board_id AND bm.user_id = s.user_id)
                                OR (b.visibility = 'friends' AND EXISTS (
                                    SELECT 1 FROM friendship f WHERE f.status = 'accepted'
                                    AND ((f.requester_user_id = b.owner_user_id AND f.recipient_user_id = s.user_id)
                                      OR (f.recipient_user_id = b.owner_user_id AND f.requester_user_id = s.user_id)))))
                     ) recipients
                     WHERE b.board_id = $1 AND b.status = 'published'`,
                    [boardId, authorUserId, comment.commentId]
                );
                await client.query("COMMIT");
                return comment;
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        },
        async update(boardId, commentId, authorUserId, revision, body) {
            const result = await getPool().query<CommentRow>(
                `WITH updated AS (
                    UPDATE board_comment SET body = $5, edited_at = NOW(), revision = revision + 1
                    WHERE board_id = $1 AND comment_id = $2 AND author_user_id = $3 AND revision = $4 RETURNING *
                 ) SELECT ${fields} FROM updated c JOIN app_user u ON u.user_id = c.author_user_id`,
                [boardId, commentId, authorUserId, revision, body]
            );
            return result.rows[0] ? mapComment(result.rows[0]) : null;
        },
        async delete(boardId, commentId, userId, ownerUserId) {
            const result = await getPool().query(
                `DELETE FROM board_comment WHERE board_id = $1 AND comment_id = $2
                 AND (author_user_id = $3 OR $3 = $4)`,
                [boardId, commentId, userId, ownerUserId]
            );
            return result.rowCount === 1;
        }
    };
}
