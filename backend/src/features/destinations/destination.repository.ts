import { getPool } from "../../db.js";
import { countryName, toAlpha2CountryCode } from "../../shared/countries.js";
import type { DestinationRepository, DestinationBoard } from "./destination.types.js";

export function createDestinationRepository(): DestinationRepository {
    return {
        async listPublic(input) {
            const countries = [
                input.country,
                toAlpha2CountryCode(input.country),
                countryName(input.country).toUpperCase()
            ];
            // One statement checks visibility and collects summaries from the same database snapshot.
            const result = await getPool().query<{ document: DestinationBoard }>(
                `SELECT jsonb_build_object(
                   'boardId', b.board_id, 'username', u.username, 'title', b.title, 'description', b.description,
                   'durationDays', (SELECT COUNT(*)::int FROM board_day d WHERE d.board_id=b.board_id),
                   'tags', COALESCE((SELECT jsonb_agg(t.tag_name ORDER BY t.tag_name) FROM board_tag bt JOIN tag t ON t.tag_id=bt.tag_id WHERE bt.board_id=b.board_id), '[]'),
                   'activityTitles', COALESCE((SELECT jsonb_agg(a.title ORDER BY a.day_number, a.position, a.activity_id) FROM
                     (SELECT title, day_number, position, activity_id FROM activity WHERE board_id=b.board_id ORDER BY day_number, position, activity_id LIMIT 6) a), '[]'),
                   'images', COALESCE((SELECT jsonb_agg(p.image ORDER BY p.kind, p.position, p.id) FROM (
                     SELECT jsonb_build_object('url', '/api/v1/images/' || bi.uploaded_image_id || '/content?variant=display', 'alt', b.title) AS image,
                       CASE WHEN bi.uploaded_image_id=b.cover_image_id THEN 0 ELSE 1 END AS kind, bi.position, bi.uploaded_image_id AS id
                     FROM board_image bi WHERE bi.board_id=b.board_id
                     UNION ALL
                     SELECT jsonb_strip_nulls(jsonb_build_object('url', a.external_image_url, 'alt', a.title,
                       'photographer', a.external_image_photographer, 'photographerUrl', a.external_image_photographer_url, 'sourceUrl', a.external_image_source_url)),
                       2 AS kind, row_number() OVER (ORDER BY a.day_number, a.position, a.activity_id)::int AS position, a.activity_id AS id
                     FROM activity a WHERE a.board_id=b.board_id AND a.external_image_provider='unsplash' AND a.external_image_url IS NOT NULL
                     ORDER BY kind, position, id LIMIT 6
                   ) p), '[]')
                 ) AS document FROM board b JOIN app_user u ON u.user_id=b.owner_user_id
                 WHERE b.status='published' AND b.visibility='public' AND EXISTS (
                   SELECT 1 FROM activity a JOIN location l ON l.location_id=a.location_id
                   WHERE a.board_id=b.board_id AND upper(trim(l.country))=ANY($3::text[])
                   AND ($6::boolean OR 6371 * acos(LEAST(1.0, GREATEST(-1.0,
                     sin(radians(l.latitude::float8))*sin(radians($1::float8)) +
                     cos(radians(l.latitude::float8))*cos(radians($1::float8))*cos(radians(l.longitude::float8 - $2::float8))
                   ))) <= 25)
                 ) ORDER BY b.updated_at DESC, b.board_id DESC LIMIT $4 OFFSET $5`,
                [
                    input.latitude,
                    input.longitude,
                    countries,
                    input.limit + 1,
                    (input.page - 1) * input.limit,
                    input.kind === "country"
                ]
            );
            return {
                boards: result.rows.slice(0, input.limit).map((row) => row.document),
                hasMore: result.rows.length > input.limit
            };
        }
    };
}
