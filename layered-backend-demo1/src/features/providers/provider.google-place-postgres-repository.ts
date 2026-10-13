import type { Pool } from "pg";

import type { GooglePlaceReferenceRepository, SavedGooglePlaceReference } from "./provider.types.js";

interface GooglePlaceReferenceRow {
  place_id: string;
  saved_at: Date;
}

function toReference(row: GooglePlaceReferenceRow): SavedGooglePlaceReference {
  return { placeId: row.place_id, savedAt: row.saved_at.toISOString() };
}

export function createPostgresGooglePlaceReferenceRepository(pool: Pool): GooglePlaceReferenceRepository {
  return {
    save: async (placeId) => {
      const result = await pool.query<GooglePlaceReferenceRow>(
        `INSERT INTO google_place_references (place_id)
         VALUES ($1)
         ON CONFLICT (place_id) DO UPDATE SET place_id = EXCLUDED.place_id
         RETURNING place_id, saved_at`,
        [placeId],
      );
      const row = result.rows[0];
      if (!row) throw new Error("Google Place reference was not returned after saving");
      return toReference(row);
    },
    list: async () => {
      const result = await pool.query<GooglePlaceReferenceRow>(
        "SELECT place_id, saved_at FROM google_place_references ORDER BY saved_at DESC, place_id ASC",
      );
      return result.rows.map(toReference);
    },
    delete: async (placeId) => {
      const result = await pool.query("DELETE FROM google_place_references WHERE place_id = $1", [placeId]);
      return (result.rowCount ?? 0) > 0;
    },
  };
}
