import { getPool } from "../../db.js";
import type { PoolClient } from "pg";
import { AppError } from "../../shared/app-error.js";
import { mentionHandles } from "./board-comments.mentions.js";
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
    mentions: { handle: string; username: string }[];
}

const fields = `c.comment_id, c.board_id, c.author_user_id, c.body, c.created_at, c.edited_at, c.revision,
                u.display_name, u.username, u.profile_picture_image_id,
                COALESCE((SELECT json_agg(json_build_object('handle', m.handle, 'username', mu.username))
                          FROM board_comment_mention m JOIN app_user mu ON mu.user_id = m.user_id
                          WHERE m.comment_id = c.comment_id), '[]'::json) AS mentions`;

function mapComment(row: CommentRow): CommentRecord {
    return {
        commentId: row.comment_id,
        boardId: row.board_id,
        authorUserId: row.author_user_id,
        body: row.body,
        mentions: row.mentions,
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

async function saveMentions(
    client: PoolClient,
    commentId: number,
    body: string
): Promise<{ addedUserIds: string[]; removedUserIds: string[] }> {
    const handles = mentionHandles(body);
    const previous = await client.query<{ handle: string; user_id: string }>(
        "SELECT handle, user_id FROM board_comment_mention WHERE comment_id = $1",
        [commentId]
    );
    const previousByHandle = new Map(previous.rows.map((row) => [row.handle, row.user_id]));
    const previousUsers = new Set(previous.rows.map((row) => row.user_id));
    const unresolved = handles.filter((handle) => !previousByHandle.has(handle));
    const resolved = unresolved.length
        ? await client.query<{ user_id: string; username: string }>(
              "SELECT user_id, username FROM app_user WHERE lower(username) = ANY($1::text[])",
              [unresolved]
          )
        : { rows: [] };
    for (const row of resolved.rows) previousByHandle.set(row.username.toLowerCase(), row.user_id);
    const selected = handles
        .map((handle) => ({ handle, userId: previousByHandle.get(handle) }))
        .filter((entry): entry is { handle: string; userId: string } => entry.userId !== undefined);
    await client.query("DELETE FROM board_comment_mention WHERE comment_id = $1", [commentId]);
    if (selected.length) {
        await client.query(
            `INSERT INTO board_comment_mention (comment_id, handle, user_id)
             SELECT $1, entry.handle, entry.user_id
             FROM unnest($2::text[], $3::varchar[]) AS entry(handle, user_id)`,
            [commentId, selected.map((entry) => entry.handle), selected.map((entry) => entry.userId)]
        );
    }
    const selectedUsers = new Set(selected.map((entry) => entry.userId));
    return {
        addedUserIds: [...selectedUsers].filter((userId) => !previousUsers.has(userId)),
        removedUserIds: [...previousUsers].filter((userId) => !selectedUsers.has(userId))
    };
}

async function reconcileRemovedMentions(
    client: PoolClient,
    boardId: number,
    commentId: number,
    removedUserIds: string[]
): Promise<void> {
    if (!removedUserIds.length) return;
    await client.query(
        `UPDATE board_comment_notification n SET kind = 'comment'
         FROM board b
         WHERE b.board_id = $1 AND n.comment_id = $2 AND n.kind = 'mention'
           AND n.recipient_user_id = b.owner_user_id
           AND n.recipient_user_id = ANY($3::varchar[])
           AND COALESCE((SELECT s.enabled FROM board_comment_subscription s
                         WHERE s.board_id = b.board_id AND s.user_id = b.owner_user_id), TRUE)`,
        [boardId, commentId, removedUserIds]
    );
    await client.query(
        `DELETE FROM board_comment_notification
         WHERE comment_id = $1 AND recipient_user_id = ANY($2::varchar[]) AND kind = 'mention'`,
        [commentId, removedUserIds]
    );
}

async function notifyMentions(
    client: PoolClient,
    boardId: number,
    commentId: number,
    authorUserId: string,
    newlyMentionedUsers: string[]
): Promise<void> {
    if (!newlyMentionedUsers.length) return;
    await client.query(
        `INSERT INTO board_comment_notification (comment_id, recipient_user_id, kind)
         SELECT $2, u.user_id, 'mention'
         FROM board b JOIN app_user u ON u.user_id = ANY($3::varchar[])
         WHERE b.board_id = $1 AND b.status = 'published' AND u.user_id <> $4
           AND (b.owner_user_id = u.user_id OR b.visibility = 'public'
                OR EXISTS (SELECT 1 FROM board_member bm WHERE bm.board_id = b.board_id AND bm.user_id = u.user_id)
                OR (b.visibility = 'friends' AND EXISTS (
                    SELECT 1 FROM friendship f WHERE f.status = 'accepted'
                    AND ((f.requester_user_id = b.owner_user_id AND f.recipient_user_id = u.user_id)
                      OR (f.recipient_user_id = b.owner_user_id AND f.requester_user_id = u.user_id)))))
         ON CONFLICT (comment_id, recipient_user_id) DO UPDATE
           SET kind = 'mention', created_at = date_trunc('milliseconds', NOW()), read_at = NULL
           WHERE board_comment_notification.kind <> 'mention'`,
        [boardId, commentId, newlyMentionedUsers, authorUserId]
    );
}

async function readComment(client: PoolClient, commentId: number): Promise<CommentRecord> {
    const result = await client.query<CommentRow>(
        `SELECT ${fields} FROM board_comment c JOIN app_user u ON u.user_id = c.author_user_id
         WHERE c.comment_id = $1`,
        [commentId]
    );
    return mapComment(result.rows[0]!);
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
                const result = await client.query<{ comment_id: number }>(
                    "INSERT INTO board_comment (board_id, author_user_id, body) VALUES ($1, $2, $3) RETURNING comment_id",
                    [boardId, authorUserId, body]
                );
                const commentId = result.rows[0]!.comment_id;
                const { addedUserIds } = await saveMentions(client, commentId, body);
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
                    [boardId, authorUserId, commentId]
                );
                await notifyMentions(client, boardId, commentId, authorUserId, addedUserIds);
                const comment = await readComment(client, commentId);
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
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                const result = await client.query<{ comment_id: number }>(
                    `UPDATE board_comment SET body = $5, edited_at = NOW(), revision = revision + 1
                     WHERE board_id = $1 AND comment_id = $2 AND author_user_id = $3 AND revision = $4
                     RETURNING comment_id`,
                    [boardId, commentId, authorUserId, revision, body]
                );
                if (!result.rows[0]) {
                    await client.query("ROLLBACK");
                    return null;
                }
                const { addedUserIds, removedUserIds } = await saveMentions(client, commentId, body);
                await reconcileRemovedMentions(client, boardId, commentId, removedUserIds);
                await notifyMentions(client, boardId, commentId, authorUserId, addedUserIds);
                const comment = await readComment(client, commentId);
                await client.query("COMMIT");
                return comment;
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
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
