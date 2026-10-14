import { getPool } from "../../db.js";
import { AppError } from "../../shared/app-error.js";
import { countryCodeForName } from "../../shared/countries.js";
import type { UsersRepository, UserProfile, ProfileBoard, MapDestination } from "./users.types.js";

export function createUsersRepository(): UsersRepository {
    return {
        async read(userId) {
            const result = await getPool().query<{
                user_id: string;
                username: string;
                display_name: string;
                biography: string | null;
                location: string | null;
                profile_picture_image_id: number | null;
                interests: string[];
                created_at: Date;
                updated_at: Date;
            }>(
                `SELECT u.*, COALESCE((SELECT array_agg(t.tag_name ORDER BY t.tag_name) FROM user_tag ut
                   JOIN tag t ON t.tag_id=ut.tag_id WHERE ut.user_id=u.user_id), '{}') AS interests
                 FROM app_user u WHERE u.user_id=$1`,
                [userId]
            );
            const row = result.rows[0];
            if (!row) return null;
            const profile: UserProfile = {
                id: row.user_id,
                username: row.username,
                displayName: row.display_name,
                description: row.biography ?? "",
                location: row.location,
                interests: row.interests,
                profilePicture:
                    row.profile_picture_image_id === null
                        ? null
                        : {
                              imageId: row.profile_picture_image_id,
                              url: `/api/v1/images/${row.profile_picture_image_id}/content?variant=thumbnail`,
                              storageKey: null
                          },
                settings: {},
                createdAt: row.created_at.toISOString(),
                updatedAt: row.updated_at.toISOString()
            };
            return profile;
        },
        async update(userId, input) {
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                await client.query("SELECT user_id FROM app_user WHERE user_id=$1 FOR UPDATE", [userId]);
                const tags = await client.query<{ tag_id: number }>(
                    "SELECT tag_id FROM tag WHERE tag_name=ANY($1::text[])",
                    [input.interests]
                );
                if (tags.rows.length !== input.interests.length)
                    throw new AppError(
                        400,
                        "Choose up to three distinct interests from the tag list",
                        "INVALID_REQUEST"
                    );
                await client.query(
                    "UPDATE app_user SET display_name=$2, biography=$3, location=$4, updated_at=NOW() WHERE user_id=$1",
                    [userId, input.displayName, input.description, input.location]
                );
                await client.query("DELETE FROM user_tag WHERE user_id=$1", [userId]);
                await client.query("INSERT INTO user_tag (user_id, tag_id) SELECT $1, UNNEST($2::int[])", [
                    userId,
                    tags.rows.map((tag) => tag.tag_id)
                ]);
                await client.query("COMMIT");
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        },
        async setPicture(userId, imageId) {
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                const user = await client.query<{ profile_picture_image_id: number | null }>(
                    "SELECT profile_picture_image_id FROM app_user WHERE user_id=$1 FOR UPDATE",
                    [userId]
                );
                if (imageId !== null) {
                    const image = await client.query(
                        "SELECT uploaded_image_id FROM uploaded_image WHERE uploaded_image_id=$1 AND uploaded_by_user_id=$2 FOR UPDATE",
                        [imageId, userId]
                    );
                    if (!image.rows.length) throw new AppError(404, "Owned image not found", "NOT_FOUND");
                    await client.query("UPDATE uploaded_image SET orphaned_at=NULL WHERE uploaded_image_id=$1", [
                        imageId
                    ]);
                }
                await client.query(
                    "UPDATE app_user SET profile_picture_image_id=$2, updated_at=NOW() WHERE user_id=$1",
                    [userId, imageId]
                );
                const previous = user.rows[0]?.profile_picture_image_id;
                if (previous && previous !== imageId)
                    await client.query("UPDATE uploaded_image SET orphaned_at=NOW() WHERE uploaded_image_id=$1", [
                        previous
                    ]);
                await client.query("COMMIT");
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        },
        async listBoards(userId, recent) {
            const result = await getPool().query<{
                board_id: number;
                owner_user_id: string;
                title: string;
                description: string | null;
                visibility: ProfileBoard["visibility"];
                status: ProfileBoard["status"];
                is_completed: boolean;
                created_at: Date;
                updated_at: Date;
                destinations: MapDestination[];
            }>(
                `SELECT b.*, COALESCE((SELECT jsonb_agg(d) FROM (
                    SELECT DISTINCT l.location_id::text AS id, l.country, l.city, l.latitude::float8 AS latitude, l.longitude::float8 AS longitude
                    FROM activity a JOIN location l ON l.location_id=a.location_id WHERE a.board_id=b.board_id AND l.country IS NOT NULL
                ) d), '[]') AS destinations
                 FROM board b WHERE b.owner_user_id=$1 ORDER BY b.updated_at DESC, b.board_id DESC ${recent ? "LIMIT 6" : ""}`,
                [userId]
            );
            return result.rows.map((row) => ({
                id: String(row.board_id),
                ownerId: row.owner_user_id,
                title: row.title,
                description: row.description ?? "",
                visibility: row.visibility,
                status: row.status,
                isCompleted: row.is_completed,
                destinations: row.destinations.map((place) => ({
                    ...place,
                    countryCode: countryCodeForName(place.country)
                })),
                createdAt: row.created_at.toISOString(),
                updatedAt: row.updated_at.toISOString()
            }));
        },
        async stats(userId) {
            const result = await getPool().query<Record<string, number>>(
                `SELECT
                 (SELECT COUNT(DISTINCT l.country)::int FROM board b JOIN activity a ON a.board_id=b.board_id JOIN location l ON l.location_id=a.location_id WHERE b.owner_user_id=$1 AND b.is_completed AND b.status='published') AS "countriesVisited",
                 (SELECT COUNT(*)::int FROM board WHERE owner_user_id=$1) AS "boardsCreated",
                 (SELECT COUNT(*)::int FROM friendship WHERE status='accepted' AND (requester_user_id=$1 OR recipient_user_id=$1)) AS friends,
                 (SELECT COUNT(*)::int FROM saved_activities WHERE user_id=$1) AS "placesSaved",
                 (SELECT COUNT(*)::int FROM saved_boards WHERE user_id=$1) AS "boardsSaved"
                `,
                [userId]
            );
            return result.rows[0]!;
        }
    };
}
