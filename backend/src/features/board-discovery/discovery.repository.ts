import { randomUUID } from "node:crypto";
import { getPool } from "../../db.js";
import type { DiscoveryCandidate, DiscoveryRepository, Place } from "./discovery.types.js";

// $1 is always the authenticated viewer, never a user ID supplied by the browser.
const eligible = `(b.status='published' AND (b.visibility='public' OR
    (b.visibility='friends' AND (b.owner_user_id=$1 OR EXISTS (
      SELECT 1 FROM friendship f WHERE f.status='accepted' AND
        ((f.requester_user_id=b.owner_user_id AND f.recipient_user_id=$1) OR
         (f.recipient_user_id=b.owner_user_id AND f.requester_user_id=$1)))))))`;
const locationJson = (alias: string) => `jsonb_build_object('name',${alias}.name,'city',${alias}.city,
    'country',${alias}.country,'address',${alias}.address)`;

export function createDiscoveryRepository(): DiscoveryRepository {
    return {
        async placeCatalog() {
            const result = await getPool()
                .query<Place>(`SELECT DISTINCT l.city AS name,l.city,l.country,NULL::text AS address
                FROM location l WHERE l.city IS NOT NULL
                UNION SELECT DISTINCT l.name,l.city,l.country,l.address FROM board b
                JOIN location l ON l.location_id=b.primary_location_id WHERE b.primary_location_kind IN ('city','region','country')`);
            return result.rows;
        },
        async candidates(userId, scope, days) {
            const result = await getPool().query<{
                board_id: number;
                title: string;
                description: string | null;
                status: DiscoveryCandidate["status"];
                visibility: DiscoveryCandidate["visibility"];
                username: string;
                display_name: string;
                profile_picture_image_id: number | null;
                cover_image_id: number | null;
                external_cover: string | null;
                destination: Place | null;
                locations: Place[];
                tags: string[];
                activity_text: string;
                activity_count: number;
                duration_days: number;
                saved_count: number;
                saved_by_me: boolean;
                published_at: Date | null;
                updated_at: Date;
                saved_at: Date | null;
                owned: boolean;
                viewers: number;
                guests: number;
                savers: number;
                commenters: number;
            }>(
                `SELECT b.board_id,b.title,b.description,b.status,b.visibility,
                  COALESCE(b.cover_image_id,(SELECT bi.uploaded_image_id FROM board_image bi
                    WHERE bi.board_id=b.board_id ORDER BY bi.position LIMIT 1)) AS cover_image_id,
                  u.username,u.display_name,u.profile_picture_image_id,b.published_at,b.updated_at,
                  COALESCE(b.owner_user_id=$1,false) AS owned,
                  CASE WHEN d.location_id IS NULL THEN NULL ELSE ${locationJson("d")} END AS destination,
                  COALESCE((SELECT jsonb_agg(DISTINCT ${locationJson("l")}) FROM activity a
                    JOIN location l ON l.location_id=a.location_id WHERE a.board_id=b.board_id AND a.location_confirmed),'[]') AS locations,
                  COALESCE((SELECT array_agg(t.tag_name ORDER BY t.tag_name) FROM board_tag bt
                    JOIN tag t ON t.tag_id=bt.tag_id WHERE bt.board_id=b.board_id),'{}') AS tags,
                  COALESCE((SELECT string_agg(concat_ws(' ',a.title,a.note,a.type),' ') FROM activity a
                    WHERE a.board_id=b.board_id),'') AS activity_text,
                  (SELECT COUNT(*)::int FROM activity WHERE board_id=b.board_id) AS activity_count,
                  (SELECT COUNT(*)::int FROM board_day WHERE board_id=b.board_id) AS duration_days,
                  (SELECT external_image_url FROM activity WHERE board_id=b.board_id AND external_image_url IS NOT NULL
                    ORDER BY day_number,position LIMIT 1) AS external_cover,
                  (SELECT COUNT(*)::int FROM saved_boards s WHERE s.board_id=b.board_id AND s.user_id<>b.owner_user_id) AS saved_count,
                  EXISTS(SELECT 1 FROM saved_boards s WHERE s.board_id=b.board_id AND s.user_id=$1) AS saved_by_me,
                  (SELECT s.saved_at FROM saved_boards s WHERE s.board_id=b.board_id AND s.user_id=$1) AS saved_at,
                  CASE WHEN $3::int IS NULL THEN 0 ELSE (SELECT COUNT(*)::int FROM board_view v
                    WHERE v.board_id=b.board_id AND v.user_id IS NOT NULL AND v.user_id<>b.owner_user_id
                      AND v.viewed_at>NOW()-make_interval(days=>$3)) END AS viewers,
                  CASE WHEN $3::int IS NULL THEN 0 ELSE (SELECT COUNT(*)::int FROM board_view v
                    WHERE v.board_id=b.board_id AND v.user_id IS NULL
                      AND v.viewed_at>NOW()-make_interval(days=>$3)) END AS guests,
                  CASE WHEN $3::int IS NULL THEN 0 ELSE (SELECT COUNT(*)::int FROM saved_boards s
                    WHERE s.board_id=b.board_id AND s.user_id<>b.owner_user_id AND EXISTS (
                      SELECT 1 FROM board_save_event e WHERE e.board_id=s.board_id AND e.user_id=s.user_id
                        AND e.saved_at>NOW()-make_interval(days=>$3))) END AS savers,
                  CASE WHEN $3::int IS NULL THEN 0 ELSE (SELECT COUNT(DISTINCT c.author_user_id)::int FROM board_comment c
                    WHERE c.board_id=b.board_id AND c.author_user_id<>b.owner_user_id
                      AND c.created_at>NOW()-make_interval(days=>$3)) END AS commenters
                 FROM board b JOIN app_user u ON u.user_id=b.owner_user_id
                 LEFT JOIN location d ON d.location_id=b.primary_location_id
                 WHERE CASE WHEN $2='mine' THEN b.owner_user_id=$1 ELSE ${eligible} END
                   AND ($2<>'saved' OR (b.owner_user_id<>$1 AND EXISTS (
                     SELECT 1 FROM saved_boards s WHERE s.board_id=b.board_id AND s.user_id=$1)))
                 ORDER BY b.board_id`,
                [userId, scope, days ?? null]
            );
            return result.rows.map((row) => ({
                boardId: row.board_id,
                title: row.title,
                description: row.description ?? "",
                status: row.status,
                visibility: row.visibility,
                owner: {
                    username: row.username,
                    displayName: row.display_name,
                    photoUrl:
                        row.profile_picture_image_id === null
                            ? null
                            : `/api/v1/images/${row.profile_picture_image_id}/content?variant=thumbnail&boardId=${row.board_id}`
                },
                destination: row.destination,
                coverImageUrl:
                    row.cover_image_id === null
                        ? row.external_cover
                        : `/api/v1/images/${row.cover_image_id}/content?variant=display`,
                tags: row.tags,
                durationDays: row.duration_days,
                activityCount: row.activity_count,
                savedCount: row.status === "draft" ? 0 : row.saved_count,
                savedByMe: row.saved_by_me,
                firstPublishedAt: row.published_at?.toISOString() ?? null,
                updatedAt: row.updated_at.toISOString(),
                ...(row.saved_at ? { savedAt: row.saved_at.toISOString() } : {}),
                permissions: { canEditContent: row.owned, canManageBoard: row.owned },
                owned: row.owned,
                locations: row.locations,
                activityText: row.activity_text,
                viewers: row.viewers,
                guests: row.guests,
                savers: row.savers,
                commenters: row.commenters
            }));
        },
        async browser(browserId, userId) {
            const id = browserId ?? randomUUID();
            const current = browserId
                ? await getPool().query<{ user_id: string | null }>(
                      "SELECT user_id FROM board_browser WHERE browser_id=$1 AND expires_at>NOW()",
                      [id]
                  )
                : null;
            // Rotate on logout/account switches; a linked browser must never impersonate its former account.
            const valid = current?.rows[0] && (current.rows[0].user_id === null || current.rows[0].user_id === userId);
            const next = valid ? id : randomUUID();
            await getPool().query(
                `INSERT INTO board_browser(browser_id) VALUES($1)
                ON CONFLICT(browser_id) DO UPDATE SET expires_at=NOW()+INTERVAL '30 days'`,
                [next]
            );
            return next;
        },
        async mergeBrowser(browserId, userId) {
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                const browser = await client.query(
                    `UPDATE board_browser SET user_id=$2,
                    expires_at=NOW()+INTERVAL '30 days' WHERE browser_id=$1 AND expires_at>NOW()
                    AND (user_id IS NULL OR user_id=$2) RETURNING browser_id`,
                    [browserId, userId]
                );
                if (browser.rowCount) {
                    await client.query(
                        `INSERT INTO board_view(board_id,viewer_key,user_id,viewed_at)
                        SELECT board_id,$2,$3,viewed_at FROM board_view WHERE viewer_key=$1
                        ON CONFLICT(board_id,viewer_key) DO UPDATE SET viewed_at=GREATEST(board_view.viewed_at,EXCLUDED.viewed_at)`,
                        [`g:${browserId}`, `u:${userId}`, userId]
                    );
                    await client.query("DELETE FROM board_view WHERE viewer_key=$1", [`g:${browserId}`]);
                    await client.query("DELETE FROM board_view_challenge WHERE viewer_key=$1", [`g:${browserId}`]);
                }
                await client.query("COMMIT");
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        },
        async startView(boardId, viewerKey) {
            const result = await getPool().query<{ token: string }>(
                `INSERT INTO board_view_challenge(board_id,viewer_key,token)
                VALUES($1,$2,$3) ON CONFLICT(board_id,viewer_key) DO UPDATE SET token=EXCLUDED.token,
                started_at=clock_timestamp() RETURNING token`,
                [boardId, viewerKey, randomUUID()]
            );
            return result.rows[0]!.token;
        },
        async finishView(boardId, viewerKey, token, userId) {
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                // Lock the browser against a concurrent sign-in merge, then recheck its linkage.
                if (userId === null) {
                    const browser = await client.query(
                        `SELECT browser_id FROM board_browser WHERE browser_id=$1
                        AND user_id IS NULL AND expires_at>NOW() FOR UPDATE`,
                        [viewerKey.slice(2)]
                    );
                    if (!browser.rowCount) {
                        await client.query("ROLLBACK");
                        return false;
                    }
                }
                const result = await client.query(
                    `WITH qualified AS (
                    DELETE FROM board_view_challenge WHERE board_id=$2 AND viewer_key=$3 AND token=$4
                    AND started_at<=clock_timestamp()-INTERVAL '3 seconds'
                    AND started_at>clock_timestamp()-INTERVAL '2 minutes' RETURNING board_id
                  ) INSERT INTO board_view(board_id,viewer_key,user_id)
                  SELECT b.board_id,$3::text,$1::varchar FROM qualified q JOIN board b ON b.board_id=q.board_id
                  WHERE ${eligible} AND b.owner_user_id IS DISTINCT FROM $1
                  ON CONFLICT(board_id,viewer_key) DO UPDATE SET viewed_at=NOW() RETURNING board_id`,
                    [userId, boardId, viewerKey, token]
                );
                await client.query("COMMIT");
                return Boolean(result.rowCount);
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        }
    };
}
