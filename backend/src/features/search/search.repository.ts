import { getPool } from "../../db.js";
import type { SearchRepository, SearchDocument } from "./search.types.js";

export function createSearchRepository(): SearchRepository {
    return {
        async listPublic(boardId) {
            const result = await getPool().query<{ document: SearchDocument }>(
                `SELECT jsonb_build_object(
                   'id', b.board_id::text, 'entityType', 'itinerary', 'title', b.title,
                   'description', COALESCE(b.description, ''),
                   'city', COALESCE((SELECT string_agg(DISTINCT l.city, ', ') FROM activity a JOIN location l ON l.location_id=a.location_id WHERE a.board_id=b.board_id), ''),
                   'country', COALESCE((SELECT string_agg(DISTINCT l.country, ', ') FROM activity a JOIN location l ON l.location_id=a.location_id WHERE a.board_id=b.board_id), ''),
                   'tags', COALESCE((SELECT jsonb_agg(lower(t.tag_name)) FROM board_tag bt JOIN tag t ON t.tag_id=bt.tag_id WHERE bt.board_id=b.board_id), '[]'),
                   'categories', COALESCE((SELECT jsonb_agg(DISTINCT lower(a.type)) FROM activity a WHERE a.board_id=b.board_id), '[]'),
                   'location', COALESCE((SELECT jsonb_build_object('lat', l.latitude::float8, 'lon', l.longitude::float8) FROM activity a JOIN location l ON l.location_id=a.location_id WHERE a.board_id=b.board_id ORDER BY a.day_number, a.position LIMIT 1), '{"lat":0,"lon":0}'),
                   'popularity', (SELECT COUNT(*) FROM saved_boards sb WHERE sb.board_id=b.board_id),
                   'isPublic', true, 'updatedAt', b.updated_at
                 ) AS document FROM board b WHERE b.status='published' AND b.visibility='public'
                   AND ($1::int IS NULL OR b.board_id=$1) ORDER BY b.board_id`,
                [boardId ?? null]
            );
            return result.rows.map((row) => row.document);
        }
    };
}
