import { getPool } from "../../db.js";
import type { SearchRepository, SearchDocument } from "./search.types.js";

export function createSearchRepository(): SearchRepository {
    return {
        async listPublicIds() {
            const result = await getPool().query<{ id: string }>(
                "SELECT board_id::text AS id FROM board WHERE status='published' AND visibility='public' ORDER BY board_id"
            );
            return result.rows.map((row) => row.id);
        },
        async listPublic(boardIds) {
            if (boardIds?.length === 0) return [];
            const result = await getPool().query<{ document: SearchDocument }>(
                `SELECT jsonb_build_object(
                   'id', b.board_id::text, 'entityType', 'itinerary', 'title', b.title,
                   'description', COALESCE(b.description, ''),
                   'city', concat_ws(', ', destination.name, (SELECT string_agg(DISTINCT l.city, ', ') FROM activity a JOIN location l ON l.location_id=a.location_id WHERE a.board_id=b.board_id)),
                   'country', concat_ws(', ', destination.country, (SELECT string_agg(DISTINCT l.country, ', ') FROM activity a JOIN location l ON l.location_id=a.location_id WHERE a.board_id=b.board_id)),
                   'tags', COALESCE((SELECT jsonb_agg(lower(t.tag_name)) FROM board_tag bt JOIN tag t ON t.tag_id=bt.tag_id WHERE bt.board_id=b.board_id), '[]'),
                   'categories', COALESCE((SELECT jsonb_agg(DISTINCT lower(a.type)) FROM activity a WHERE a.board_id=b.board_id), '[]'),
                   'location', COALESCE(CASE WHEN destination.location_id IS NOT NULL THEN jsonb_build_object('lat',destination.latitude::float8,'lon',destination.longitude::float8) END, (SELECT jsonb_build_object('lat', l.latitude::float8, 'lon', l.longitude::float8) FROM activity a JOIN location l ON l.location_id=a.location_id WHERE a.board_id=b.board_id ORDER BY a.day_number, a.position LIMIT 1), '{"lat":0,"lon":0}'),
                   'popularity', (SELECT COUNT(*) FROM saved_boards sb WHERE sb.board_id=b.board_id),
                   'isPublic', true, 'updatedAt', b.updated_at
                 ) AS document FROM board b LEFT JOIN location destination ON destination.location_id=b.primary_location_id WHERE b.status='published' AND b.visibility='public'
                   AND ($1::text[] IS NULL OR b.board_id::text=ANY($1::text[])) ORDER BY b.board_id`,
                [boardIds ?? null]
            );
            return result.rows.map((row) => row.document);
        }
    };
}
