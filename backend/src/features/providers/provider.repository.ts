import { getPool } from "../../db.js";

import type { GooglePlaceReferenceRepository, SavedGooglePlaceReference } from "./provider.types.js";

interface GooglePlaceReferenceRow {
    place_id: string;
    saved_at: Date;
}

function toReference(row: GooglePlaceReferenceRow): SavedGooglePlaceReference {
    return { placeId: row.place_id, savedAt: row.saved_at.toISOString() };
}

export function createPostgresGooglePlaceReferenceRepository(): GooglePlaceReferenceRepository {
    return {
        save: async (userId, placeId) => {
            const result = await getPool().query<GooglePlaceReferenceRow>(
                `INSERT INTO google_place_reference (user_id, place_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, place_id) DO UPDATE SET place_id = EXCLUDED.place_id
         RETURNING place_id, saved_at`,
                [userId, placeId]
            );
            const row = result.rows[0];
            if (!row) throw new Error("Google Place reference was not returned after saving");
            return toReference(row);
        },
        list: async (userId) => {
            const result = await getPool().query<GooglePlaceReferenceRow>(
                "SELECT place_id, saved_at FROM google_place_reference WHERE user_id = $1 ORDER BY saved_at DESC, place_id ASC",
                [userId]
            );
            return result.rows.map(toReference);
        },
        delete: async (userId, placeId) => {
            const result = await getPool().query(
                "DELETE FROM google_place_reference WHERE user_id = $1 AND place_id = $2",
                [userId, placeId]
            );
            return (result.rowCount ?? 0) > 0;
        }
    };
}
