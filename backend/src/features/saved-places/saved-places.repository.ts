import { getPool } from "../../db.js";
import type { SavedPlace, SavedPlacesRepository } from "./saved-places.types.js";

type Row = Omit<SavedPlace, "id" | "savedAt"> & { place_id: string; saved_at: Date };
function toPlace({ place_id, saved_at, ...place }: Row): SavedPlace {
    return { ...place, id: place_id, savedAt: saved_at.toISOString() };
}

export function createSavedPlacesRepository(): SavedPlacesRepository {
    return {
        async list(userId) {
            const result = await getPool().query<Row>(
                `SELECT place_id, name, address, latitude, longitude, city, country, saved_at
                 FROM saved_place WHERE user_id=$1 ORDER BY saved_at DESC, place_id`,
                [userId]
            );
            return result.rows.map(toPlace);
        },
        async save(userId, place) {
            // The account is part of the conflict target, so another user's save cannot be changed.
            const result = await getPool().query<Row>(
                `INSERT INTO saved_place (user_id, place_id, name, address, latitude, longitude, city, country)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                 ON CONFLICT (user_id, place_id) DO UPDATE SET
                   name=EXCLUDED.name, address=EXCLUDED.address, latitude=EXCLUDED.latitude,
                   longitude=EXCLUDED.longitude, city=EXCLUDED.city, country=EXCLUDED.country
                 RETURNING place_id, name, address, latitude, longitude, city, country, saved_at`,
                [
                    userId,
                    place.id,
                    place.name,
                    place.address,
                    place.latitude,
                    place.longitude,
                    place.city,
                    place.country
                ]
            );
            return toPlace(result.rows[0]!);
        },
        async remove(userId, placeId) {
            await getPool().query("DELETE FROM saved_place WHERE user_id=$1 AND place_id=$2", [userId, placeId]);
        }
    };
}
