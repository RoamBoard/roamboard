import type { Pool } from "pg";
import { getPool } from "../../db.js";
import { AppError } from "../../shared/app-error.js";
import { countryCodeForName } from "../../shared/countries.js";
import { continentForCountry } from "../../shared/continents.js";
import type { UsersRepository, UserProfile, ProfileBoard, MapDestination } from "./users.types.js";

export function createUsersRepository(pool?: Pick<Pool, "query">): UsersRepository {
    const getDb = () => pool ?? getPool();
    return {
        async read(userId) {
            const result = await getPool().query<{
                user_id: string;
                username: string;
                display_name: string;
                biography: string | null;
                location: string | null;
                occupation: string | null;
                default_board_visibility: UserProfile["defaultBoardVisibility"];
                profile_revision: number;
                profile_picture_image_id: number | null;
                interests: string[];
                languages: string[];
                created_at: Date;
                updated_at: Date;
            }>(
                `SELECT u.*, COALESCE((SELECT array_agg(t.tag_name ORDER BY t.tag_name) FROM user_tag ut
                   JOIN tag t ON t.tag_id=ut.tag_id WHERE ut.user_id=u.user_id), '{}') AS interests,
                   COALESCE((SELECT array_agg(language_name ORDER BY language_name) FROM user_language WHERE user_id=u.user_id), '{}') AS languages
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
                occupation: row.occupation,
                languages: row.languages,
                interests: row.interests,
                profilePicture:
                    row.profile_picture_image_id === null
                        ? null
                        : {
                              imageId: row.profile_picture_image_id,
                              url: `/api/v1/images/${row.profile_picture_image_id}/content?variant=thumbnail&profileHandle=${encodeURIComponent(row.username)}`,
                              storageKey: null
                          },
                defaultBoardVisibility: row.default_board_visibility,
                revision: row.profile_revision,
                createdAt: row.created_at.toISOString(),
                updatedAt: row.updated_at.toISOString()
            };
            return profile;
        },
        async findIdByHandle(handle) {
            const cleanHandle = handle.replace(/^@+/, "").trim();
            const result = await getPool().query<{ user_id: string }>(
                "SELECT user_id FROM app_user WHERE username=$1",
                [cleanHandle]
            );
            return result.rows[0]?.user_id ?? null;
        },
        async update(userId, input) {
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                const current = await client.query<{ profile_revision: number }>(
                    "SELECT profile_revision FROM app_user WHERE user_id=$1 FOR UPDATE",
                    [userId]
                );
                if (!current.rows[0]) throw new AppError(404, "Profile not found", "NOT_FOUND");
                if (current.rows[0].profile_revision !== input.revision)
                    throw new AppError(409, "Your profile changed. Reload it before saving.", "STALE_PROFILE");
                const tags = await client.query<{ tag_id: number }>(
                    "SELECT tag_id FROM tag WHERE tag_name=ANY($1::text[])",
                    [input.interests]
                );
                if (tags.rows.length !== input.interests.length)
                    throw new AppError(400, "Choose interests from the tag list", "INVALID_REQUEST");
                const languages = await client.query<{ language_name: string }>(
                    "SELECT language_name FROM language WHERE language_name=ANY($1::text[])",
                    [input.languages]
                );
                if (languages.rows.length !== input.languages.length)
                    throw new AppError(400, "Choose languages from the list", "INVALID_REQUEST");
                try {
                    await client.query(
                        `UPDATE app_user SET username=$2, display_name=$3, biography=$4, location=$5,
                         occupation=$6, default_board_visibility=$7, profile_revision=profile_revision+1,
                         updated_at=NOW() WHERE user_id=$1`,
                        [
                            userId,
                            input.username,
                            input.displayName,
                            input.description,
                            input.location,
                            input.occupation,
                            input.defaultBoardVisibility
                        ]
                    );
                } catch (error) {
                    if ((error as { code?: string }).code === "23505")
                        throw new AppError(409, "That username is already taken.", "USERNAME_TAKEN");
                    throw error;
                }
                await client.query("DELETE FROM user_tag WHERE user_id=$1", [userId]);
                await client.query("INSERT INTO user_tag (user_id, tag_id) SELECT $1, UNNEST($2::int[])", [
                    userId,
                    tags.rows.map((tag) => tag.tag_id)
                ]);
                await client.query("DELETE FROM user_language WHERE user_id=$1", [userId]);
                await client.query("INSERT INTO user_language (user_id, language_name) SELECT $1, UNNEST($2::text[])", [
                    userId,
                    input.languages
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
                    "UPDATE app_user SET profile_picture_image_id=$2, profile_revision=profile_revision+1, updated_at=NOW() WHERE user_id=$1",
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
        async listBoards(userId, recent, publicOnly = false, viewerId = null, saved = false) {
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
                cover_image_id: number | null;
                destinations: MapDestination[];
                activity_count: number;
            }>(
                `SELECT b.*,
                    (SELECT COUNT(*)::int FROM activity WHERE board_id=b.board_id) AS activity_count,
                    COALESCE((SELECT jsonb_agg(d) FROM (
                    SELECT DISTINCT l.location_id::text AS id, l.country, l.city, l.latitude::float8 AS latitude, l.longitude::float8 AS longitude
                    FROM (
                        SELECT b.primary_location_id AS location_id
                        UNION
                        SELECT a.location_id FROM activity a
                        WHERE a.board_id=b.board_id AND a.location_confirmed
                    ) board_locations
                    JOIN location l ON l.location_id=board_locations.location_id
                    WHERE l.country IS NOT NULL
                ) d), '[]') AS destinations
                 FROM board b WHERE ${
                     saved
                         ? "EXISTS (SELECT 1 FROM saved_boards sb WHERE sb.board_id=b.board_id AND sb.user_id=$1) AND b.owner_user_id<>$1"
                         : "b.owner_user_id=$1"
                 }
                 ${
                     publicOnly || saved
                         ? `AND b.status='published' AND (b.visibility='public' OR
                    (b.visibility='friends' AND ($2=b.owner_user_id OR EXISTS (
                        SELECT 1 FROM friendship f WHERE f.status='accepted' AND
                        ((f.requester_user_id=b.owner_user_id AND f.recipient_user_id=$2) OR
                         (f.recipient_user_id=b.owner_user_id AND f.requester_user_id=$2))
                    ))))`
                         : ""
                 }
                 ORDER BY b.updated_at DESC, b.board_id DESC ${recent ? "LIMIT 6" : ""}`,
                publicOnly || saved ? [userId, viewerId] : [userId]
            );
            return result.rows.map((row) => ({
                id: String(row.board_id),
                ownerId: row.owner_user_id,
                title: row.title,
                description: row.description ?? "",
                visibility: row.visibility,
                status: row.status,
                isCompleted: row.is_completed,
                activityCount: row.activity_count,
                destinations: row.destinations.map((place) => ({
                    ...place,
                    countryCode: countryCodeForName(place.country)
                })),
                createdAt: row.created_at.toISOString(),
                updatedAt: row.updated_at.toISOString(),
                coverImageUrl:
                    row.cover_image_id === null
                        ? null
                        : `/api/v1/images/${row.cover_image_id}/content?variant=thumbnail`
            }));
        },
        async countPublicPhotos(userId, viewerId = null) {
            const result = await getPool().query<{ count: number }>(
                `SELECT COUNT(DISTINCT bi.uploaded_image_id)::int AS count
                 FROM board_image bi JOIN board b ON b.board_id=bi.board_id
                 WHERE b.owner_user_id=$1 AND b.status='published' AND (b.visibility='public' OR
                    (b.visibility='friends' AND ($2=b.owner_user_id OR EXISTS (
                        SELECT 1 FROM friendship f WHERE f.status='accepted' AND
                        ((f.requester_user_id=b.owner_user_id AND f.recipient_user_id=$2) OR
                         (f.recipient_user_id=b.owner_user_id AND f.requester_user_id=$2))
                    ))))`,
                [userId, viewerId]
            );
            return result.rows[0]?.count ?? 0;
        },
        async stats(userId) {
            const [locations, counts] = await Promise.all([
                getPool().query<{ country: string; city: string | null }>(
                    `SELECT DISTINCT l.country, l.city FROM board b
                     JOIN activity a ON a.board_id=b.board_id JOIN location l ON l.location_id=a.location_id
                     WHERE b.owner_user_id=$1 AND b.is_completed AND b.status='published'
                       AND a.location_confirmed AND l.country IS NOT NULL`,
                    [userId]
                ),
                getPool().query<{
                    photosUploaded: number;
                    boardsCreated: number;
                    friends: number;
                    activitiesSaved: number;
                    boardsSaved: number;
                }>(
                    `SELECT
                     (SELECT COUNT(DISTINCT bi.uploaded_image_id)::int FROM board_image bi JOIN board b ON b.board_id=bi.board_id
                        WHERE b.owner_user_id=$1 AND b.is_completed AND b.status='published') AS "photosUploaded",
                     (SELECT COUNT(*)::int FROM board WHERE owner_user_id=$1 AND status='published') AS "boardsCreated",
                     (SELECT COUNT(*)::int FROM friendship WHERE status='accepted' AND
                        (requester_user_id=$1 OR recipient_user_id=$1)) AS friends,
                     (SELECT COUNT(*)::int FROM saved_activities WHERE user_id=$1) AS "activitiesSaved",
                     (SELECT COUNT(*)::int FROM saved_boards sb JOIN board b ON b.board_id=sb.board_id
                        WHERE sb.user_id=$1 AND b.status='published' AND b.owner_user_id<>$1 AND
                        (b.visibility='public' OR
                         (b.visibility='friends' AND EXISTS (SELECT 1 FROM friendship f WHERE f.status='accepted' AND
                            ((f.requester_user_id=b.owner_user_id AND f.recipient_user_id=$1) OR
                             (f.recipient_user_id=b.owner_user_id AND f.requester_user_id=$1)))) OR
                         EXISTS (SELECT 1 FROM board_member bm WHERE bm.board_id=b.board_id AND bm.user_id=$1))) AS "boardsSaved"`,
                    [userId]
                )
            ]);
            const countries = new Set<string>();
            const cities = new Set<string>();
            const continents = new Set<string>();
            for (const row of locations.rows) {
                const code = countryCodeForName(row.country);
                if (!code) continue;
                countries.add(code);
                if (row.city?.trim()) cities.add(`${code}:${row.city.trim().toLocaleLowerCase("en")}`);
                const continent = continentForCountry(code);
                if (continent) continents.add(continent);
            }
            const countRow = counts.rows[0];
            return {
                countriesVisited: countries.size,
                citiesExplored: cities.size,
                continentsCovered: continents.size,
                photosUploaded: countRow?.photosUploaded ?? 0,
                boardsCreated: countRow?.boardsCreated ?? 0,
                friends: countRow?.friends ?? 0,
                activitiesSaved: countRow?.activitiesSaved ?? 0,
                boardsSaved: countRow?.boardsSaved ?? 0
            };
        },
        async listSavedBoards(userId, page, limit) {
            const result = await getPool().query<{
                board_id: number;
                title: string;
                description: string | null;
                owner_user_id: string;
                username: string;
                display_name: string;
                cover_image_id: number | null;
                saved_at: Date;
            }>(
                `SELECT b.board_id, b.title, b.description, b.owner_user_id, u.username, u.display_name,
                        b.cover_image_id, sb.saved_at FROM saved_boards sb
                 JOIN board b ON b.board_id=sb.board_id JOIN app_user u ON u.user_id=b.owner_user_id
                 WHERE sb.user_id=$1 AND b.status='published' AND b.owner_user_id<>$1 AND
                   (b.visibility='public' OR
                    (b.visibility='friends' AND EXISTS (SELECT 1 FROM friendship f WHERE f.status='accepted' AND
                       ((f.requester_user_id=b.owner_user_id AND f.recipient_user_id=$1) OR
                        (f.recipient_user_id=b.owner_user_id AND f.requester_user_id=$1)))) OR
                    EXISTS (SELECT 1 FROM board_member bm WHERE bm.board_id=b.board_id AND bm.user_id=$1))
                 ORDER BY sb.saved_at DESC, b.board_id DESC LIMIT $2 OFFSET $3`,
                [userId, limit + 1, (page - 1) * limit]
            );
            return {
                items: result.rows.slice(0, limit).map((row) => ({
                    boardId: row.board_id,
                    title: row.title,
                    description: row.description ?? "",
                    owner: { id: row.owner_user_id, username: row.username, displayName: row.display_name },
                    coverImageUrl:
                        row.cover_image_id === null
                            ? null
                            : `/api/v1/images/${row.cover_image_id}/content?variant=thumbnail`,
                    savedAt: row.saved_at.toISOString()
                })),
                hasMore: result.rows.length > limit
            };
        },
        async saveBoard(userId, boardId) {
            const result = await getPool().query(
                `INSERT INTO saved_boards (user_id, board_id) VALUES ($1, $2)
                 ON CONFLICT (board_id, user_id) DO NOTHING RETURNING board_id`,
                [userId, boardId]
            );
            return result.rowCount === 1;
        },
        async unsaveBoard(userId, boardId) {
            await getPool().query("DELETE FROM saved_boards WHERE user_id=$1 AND board_id=$2", [userId, boardId]);
        },
        async getFriendship(userId1, userId2) {
            const result = await getPool().query<{
                friendship_id: number;
                status: "pending" | "accepted";
                requester_user_id: string;
                recipient_user_id: string;
            }>(
                `SELECT friendship_id, status, requester_user_id, recipient_user_id
                 FROM friendship
                 WHERE (requester_user_id = $1 AND recipient_user_id = $2)
                    OR (requester_user_id = $2 AND recipient_user_id = $1)`,
                [userId1, userId2]
            );
            const row = result.rows[0];
            if (!row) return null;
            return {
                friendshipId: row.friendship_id,
                status: row.status,
                requesterUserId: row.requester_user_id,
                recipientUserId: row.recipient_user_id
            };
        },
        async sendFriendRequest(requesterId, recipientId) {
            const result = await getPool().query<{ friendship_id: number }>(
                `INSERT INTO friendship (requester_user_id, recipient_user_id, status)
                 VALUES ($1, $2, 'pending')
                 RETURNING friendship_id`,
                [requesterId, recipientId]
            );
            const row = result.rows[0];
            if (!row) throw new AppError(500, "Failed to create friend request", "INTERNAL_ERROR");
            return row.friendship_id;
        },
        async listIncomingFriendRequests(userId) {
            const result = await getPool().query<{
                friendship_id: number;
                requester_user_id: string;
                username: string;
                display_name: string;
                profile_picture_image_id: number | null;
            }>(
                `SELECT f.friendship_id, f.requester_user_id, u.username, u.display_name, u.profile_picture_image_id
                 FROM friendship f
                 JOIN app_user u ON u.user_id = f.requester_user_id
                 WHERE f.recipient_user_id = $1 AND f.status = 'pending'
                 ORDER BY f.friendship_id DESC`,
                [userId]
            );
            return result.rows.map((row) => ({
                requestId: row.friendship_id,
                requester: {
                    userId: row.requester_user_id,
                    username: row.username,
                    displayName: row.display_name,
                    profilePictureUrl:
                        row.profile_picture_image_id === null
                            ? null
                            : `/api/v1/images/${row.profile_picture_image_id}/content?variant=thumbnail&profileHandle=${encodeURIComponent(row.username)}`
                }
            }));
        },
        async acceptFriendRequest(recipientId, requestId) {
            try {
                const result = await getDb().query(
                    `UPDATE friendship
                     SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP
                     WHERE friendship_id = $1 AND recipient_user_id = $2 AND status = 'pending'`,
                    [requestId, recipientId]
                );
                return (result.rowCount ?? 0) > 0;
            } catch (error: unknown) {
                if (error && typeof error === "object" && "code" in error && error.code === "42703") {
                    const result = await getDb().query(
                        `UPDATE friendship
                         SET status = 'accepted'
                         WHERE friendship_id = $1 AND recipient_user_id = $2 AND status = 'pending'`,
                        [requestId, recipientId]
                    );
                    return (result.rowCount ?? 0) > 0;
                }
                throw error;
            }
        },
        async rejectFriendRequest(userId, requestId) {
            const result = await getPool().query(
                `DELETE FROM friendship
                 WHERE friendship_id = $1 AND (recipient_user_id = $2 OR requester_user_id = $2) AND status = 'pending'`,
                [requestId, userId]
            );
            return (result.rowCount ?? 0) > 0;
        },
        async listFriends(userId) {
            let result;
            try {
                result = await getDb().query<{
                    friendship_id: number;
                    accepted_at: Date | null;
                    user_id: string;
                    username: string;
                    display_name: string;
                    profile_picture_image_id: number | null;
                    biography: string | null;
                    location: string | null;
                }>(
                    `SELECT f.friendship_id, f.accepted_at, u.user_id, u.username, u.display_name, u.profile_picture_image_id, u.biography, u.location
                     FROM friendship f
                     JOIN app_user u ON u.user_id = (CASE WHEN f.requester_user_id = $1 THEN f.recipient_user_id ELSE f.requester_user_id END)
                     WHERE (f.requester_user_id = $1 OR f.recipient_user_id = $1) AND f.status = 'accepted'
                     ORDER BY u.display_name ASC`,
                    [userId]
                );
            } catch (error: unknown) {
                if (error && typeof error === "object" && "code" in error && error.code === "42703") {
                    result = await getDb().query<{
                        friendship_id: number;
                        accepted_at: Date | null;
                        user_id: string;
                        username: string;
                        display_name: string;
                        profile_picture_image_id: number | null;
                        biography: string | null;
                        location: string | null;
                    }>(
                        `SELECT f.friendship_id, NULL::timestamptz AS accepted_at, u.user_id, u.username, u.display_name, u.profile_picture_image_id, u.biography, u.location
                         FROM friendship f
                         JOIN app_user u ON u.user_id = (CASE WHEN f.requester_user_id = $1 THEN f.recipient_user_id ELSE f.requester_user_id END)
                         WHERE (f.requester_user_id = $1 OR f.recipient_user_id = $1) AND f.status = 'accepted'
                         ORDER BY u.display_name ASC`,
                        [userId]
                    );
                } else {
                    throw error;
                }
            }
            return result.rows.map((row) => ({
                friendshipId: row.friendship_id,
                acceptedAt: row.accepted_at ? row.accepted_at.toISOString() : null,
                userId: row.user_id,
                username: row.username,
                displayName: row.display_name,
                profilePictureUrl:
                    row.profile_picture_image_id === null
                        ? null
                        : `/api/v1/images/${row.profile_picture_image_id}/content?variant=thumbnail&profileHandle=${encodeURIComponent(row.username)}`,
                bio: row.biography,
                location: row.location
            }));
        },
        async searchUsers(userId, query, limit) {
            const cleanQuery = query.replace(/^@+/, "").trim();
            const pattern = `%${cleanQuery}%`;
            const isMatchAll = cleanQuery.length === 0;
            const result = await getPool().query<{
                user_id: string;
                username: string;
                display_name: string;
                profile_picture_image_id: number | null;
                biography: string | null;
                location: string | null;
                friendship_id: number | null;
                friendship_status: "pending" | "accepted" | null;
                requester_user_id: string | null;
            }>(
                `SELECT u.user_id, u.username, u.display_name, u.profile_picture_image_id, u.biography, u.location,
                        f.friendship_id, f.status as friendship_status, f.requester_user_id
                 FROM app_user u
                 LEFT JOIN friendship f ON (
                    (f.requester_user_id = $1 AND f.recipient_user_id = u.user_id) OR
                    (f.recipient_user_id = $1 AND f.requester_user_id = u.user_id)
                 )
                 WHERE u.user_id <> $1
                   ${isMatchAll ? "" : "AND (u.username ILIKE $2 OR u.display_name ILIKE $2)"}
                 ORDER BY u.display_name ASC
                 LIMIT ${isMatchAll ? "$2" : "$3"}`,
                isMatchAll ? [userId, limit] : [userId, pattern, limit]
            );
            return result.rows.map((row) => {
                let friendshipStatus: "none" | "pending_sent" | "pending_received" | "accepted" = "none";
                if (row.friendship_status === "accepted") {
                    friendshipStatus = "accepted";
                } else if (row.friendship_status === "pending") {
                    friendshipStatus = row.requester_user_id === userId ? "pending_sent" : "pending_received";
                }
                return {
                    userId: row.user_id,
                    username: row.username,
                    displayName: row.display_name,
                    profilePictureUrl:
                        row.profile_picture_image_id === null
                            ? null
                            : `/api/v1/images/${row.profile_picture_image_id}/content?variant=thumbnail&profileHandle=${encodeURIComponent(row.username)}`,
                    bio: row.biography,
                    location: row.location,
                    friendshipStatus,
                    requestId: row.friendship_id ?? undefined
                };
            });
        },
        async listFriendsBoards(userId, limit) {
            const result = await getPool().query<{
                board_id: number;
                title: string;
                description: string | null;
                owner_user_id: string;
                username: string;
                display_name: string;
                profile_picture_image_id: number | null;
                cover_image_id: number | null;
                created_at: Date;
            }>(
                `SELECT b.board_id, b.title, b.description, b.owner_user_id,
                        u.username, u.display_name, u.profile_picture_image_id,
                        b.cover_image_id, COALESCE(b.published_at, b.created_at) AS created_at
                 FROM board b
                 JOIN app_user u ON u.user_id = b.owner_user_id
                 JOIN friendship f ON (
                    (f.requester_user_id = $1 AND f.recipient_user_id = b.owner_user_id) OR
                    (f.recipient_user_id = $1 AND f.requester_user_id = b.owner_user_id)
                 )
                 WHERE f.status = 'accepted'
                   AND b.status = 'published'
                   AND (b.visibility = 'public' OR b.visibility = 'friends')
                 ORDER BY COALESCE(b.published_at, b.created_at) DESC
                 LIMIT $2`,
                [userId, limit]
            );
            return result.rows.map((row) => ({
                boardId: row.board_id,
                title: row.title,
                description: row.description,
                owner: {
                    userId: row.owner_user_id,
                    username: row.username,
                    displayName: row.display_name,
                    profilePictureUrl:
                        row.profile_picture_image_id === null
                            ? null
                            : `/api/v1/images/${row.profile_picture_image_id}/content?variant=thumbnail&profileHandle=${encodeURIComponent(row.username)}`
                },
                coverImageUrl:
                    row.cover_image_id === null ? null : `/api/v1/images/${row.cover_image_id}/content?variant=display`,
                createdAt: row.created_at.toISOString()
            }));
        },
        async listFriendsActivity(userId, limit) {
            const result = await getPool().query<{
                board_id: number;
                title: string;
                owner_user_id: string;
                username: string;
                display_name: string;
                profile_picture_image_id: number | null;
                cover_image_id: number | null;
                published_at: Date;
            }>(
                `SELECT b.board_id, b.title, b.owner_user_id,
                        u.username, u.display_name, u.profile_picture_image_id,
                        b.cover_image_id, COALESCE(b.published_at, b.created_at) AS published_at
                 FROM board b
                 JOIN app_user u ON u.user_id = b.owner_user_id
                 JOIN friendship f ON (
                    (f.requester_user_id = $1 AND f.recipient_user_id = b.owner_user_id) OR
                    (f.recipient_user_id = $1 AND f.requester_user_id = b.owner_user_id)
                 )
                 WHERE f.status = 'accepted'
                   AND b.status = 'published'
                   AND (b.visibility = 'public' OR b.visibility = 'friends')
                 ORDER BY COALESCE(b.published_at, b.created_at) DESC
                 LIMIT $2`,
                [userId, limit]
            );
            return result.rows.map((row) => ({
                activityType: "published_board" as const,
                boardId: row.board_id,
                title: row.title,
                owner: {
                    userId: row.owner_user_id,
                    username: row.username,
                    displayName: row.display_name,
                    profilePictureUrl:
                        row.profile_picture_image_id === null
                            ? null
                            : `/api/v1/images/${row.profile_picture_image_id}/content?variant=thumbnail&profileHandle=${encodeURIComponent(row.username)}`
                },
                coverImageUrl:
                    row.cover_image_id === null ? null : `/api/v1/images/${row.cover_image_id}/content?variant=display`,
                timestamp: row.published_at.toISOString()
            }));
        },
        async removeFriend(userId, targetUserId) {
            const result = await getPool().query(
                `DELETE FROM friendship
                 WHERE ((requester_user_id = $1 AND recipient_user_id = $2) OR (requester_user_id = $2 AND recipient_user_id = $1))
                   AND status = 'accepted'`,
                [userId, targetUserId]
            );
            return (result.rowCount ?? 0) > 0;
        },
        async removeFriendByHandle(userId, handle) {
            const cleanHandle = handle.replace(/^@+/, "").trim().toLowerCase();
            const target = await getPool().query<{ user_id: string }>(
                "SELECT user_id FROM app_user WHERE LOWER(username) = $1",
                [cleanHandle]
            );
            const targetUserId = target.rows[0]?.user_id;
            if (!targetUserId) return false;
            return this.removeFriend(userId, targetUserId);
        }
    };
}
