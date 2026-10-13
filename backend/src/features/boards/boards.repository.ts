import type { PoolClient } from "pg";

import { getPool } from "../../db.js";
import { AppError } from "../../shared/app-error.js";
import type { BoardLocationWrite, BoardWrite } from "./boards.schemas.js";
import { canReadBoard, type BoardAccess, type BoardDocument, type BoardRepository, type DraftSummary, type PublishedSummary } from "./boards.types.js";

interface BoardRow {
    board_id: number;
    owner_user_id: string;
    title: string;
    description: string | null;
    visibility: BoardAccess["visibility"];
    status: BoardAccess["status"];
    revision: number;
    is_completed: boolean;
    cover_image_id: number | null;
    created_at: Date;
    updated_at: Date;
}

interface LocationRow {
    location_id: number;
    name: string;
    latitude: string;
    longitude: string;
    address: string | null;
    city: string | null;
    country: string | null;
    external_place_id: string | null;
}

function imagePath(id: number, variant: "display" | "thumbnail"): string {
    return `/api/v1/images/${id}/content?variant=${variant}`;
}

function keyForLocation(location: BoardLocationWrite): string {
    return JSON.stringify([
        location.name,
        Number(location.latitude.toFixed(6)),
        Number(location.longitude.toFixed(6)),
        location.address,
        location.city,
        location.country,
        location.externalPlaceId
    ]);
}

function locationFromRow(row: LocationRow): BoardLocationWrite {
    return {
        name: row.name,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        address: row.address,
        city: row.city,
        country: row.country,
        externalPlaceId: row.external_place_id
    };
}

async function resolveLocations(client: PoolClient, input: BoardWrite): Promise<Map<string, number>> {
    const unique = new Map<string, BoardLocationWrite>();
    for (const day of input.days) for (const activity of day.activities) {
        if (activity.location) unique.set(keyForLocation(activity.location), activity.location);
    }
    const resolved = new Map<string, number>();
    if (!unique.size) return resolved;

    const coordinates = [...unique.values()];
    const existing = await client.query<LocationRow>(
        `SELECT location_id, name, latitude, longitude, address, city, country, external_place_id
         FROM location
         WHERE latitude = ANY($1::numeric[]) AND longitude = ANY($2::numeric[])`,
        [coordinates.map((item) => Number(item.latitude.toFixed(6))),
            coordinates.map((item) => Number(item.longitude.toFixed(6)))]
    );
    for (const row of existing.rows) {
        const key = keyForLocation(locationFromRow(row));
        if (unique.has(key) && !resolved.has(key)) resolved.set(key, row.location_id);
    }

    const missing = [...unique.entries()].filter(([key]) => !resolved.has(key));
    if (!missing.length) return resolved;
    const values: unknown[] = [];
    const placeholders = missing.map(([, location], index) => {
        values.push(location.name, location.latitude, location.longitude,
            location.address, location.city, location.country, location.externalPlaceId);
        const n = index * 7;
        return `($${n + 1},$${n + 2},$${n + 3},$${n + 4},$${n + 5},$${n + 6},$${n + 7})`;
    });
    const inserted = await client.query<LocationRow>(
        `INSERT INTO location (name, latitude, longitude, address, city, country, external_place_id)
         VALUES ${placeholders.join(",")}
         RETURNING location_id, name, latitude, longitude, address, city, country, external_place_id`,
        values
    );
    for (const row of inserted.rows) resolved.set(keyForLocation(locationFromRow(row)), row.location_id);
    return resolved;
}

async function verifyImageOwnership(client: PoolClient, imageIds: number[], userId: string, boardId: number): Promise<void> {
    if (!imageIds.length) return;
    const result = await client.query<{ uploaded_image_id: number; uploaded_by_user_id: string; board_id: number | null }>(
        `SELECT i.uploaded_image_id, i.uploaded_by_user_id, bi.board_id
         FROM uploaded_image i LEFT JOIN board_image bi ON bi.uploaded_image_id = i.uploaded_image_id
         WHERE i.uploaded_image_id = ANY($1::int[]) FOR UPDATE OF i`,
        [imageIds]
    );
    if (result.rows.length !== imageIds.length || result.rows.some((row) =>
        (row.board_id !== boardId &&
            (row.board_id !== null || row.uploaded_by_user_id !== userId)))) {
        throw new AppError(400, "Invalid image reference", "INVALID_REQUEST");
    }
}

async function verifyChildIds(client: PoolClient, boardId: number, input: BoardWrite): Promise<void> {
    const dayIds = input.days.flatMap((day) => day.dayId === undefined ? [] : [day.dayId]);
    const activityIds = input.days.flatMap((day) => day.activities.flatMap((activity) =>
        activity.activityId === undefined ? [] : [activity.activityId]));
    const days = await client.query<{ day_id: number }>(
            "SELECT day_id FROM board_day WHERE board_id = $1 AND day_id = ANY($2::int[])",
            [boardId, dayIds]
        );
    const activities = await client.query<{ activity_id: number }>(
            "SELECT activity_id FROM activity WHERE board_id = $1 AND activity_id = ANY($2::int[])",
            [boardId, activityIds]
        );
    if (days.rows.length !== dayIds.length || activities.rows.length !== activityIds.length) {
        throw new AppError(400, "Invalid child ID", "INVALID_REQUEST");
    }
}

async function writeChildren(client: PoolClient, boardId: number, userId: string, input: BoardWrite): Promise<void> {
    await verifyChildIds(client, boardId, input);
    await verifyImageOwnership(client, input.imageIds, userId, boardId);
    const locations = await resolveLocations(client, input);

    await client.query("DELETE FROM board_tag WHERE board_id = $1", [boardId]);
    if (input.tagIds.length) {
        await client.query(
            "INSERT INTO board_tag (board_id, tag_id) SELECT $1, UNNEST($2::int[])",
            [boardId, input.tagIds]
        );
    }

    const retainedActivityIds = input.days.flatMap((day) => day.activities.flatMap((activity) =>
        activity.activityId === undefined ? [] : [activity.activityId]));
    await client.query(
        `DELETE FROM activity_image USING activity a
         WHERE activity_image.activity_id = a.activity_id AND a.board_id = $1`, [boardId]
    );
    await client.query(
        "DELETE FROM activity WHERE board_id = $1 AND activity_id <> ALL($2::int[])",
        [boardId, retainedActivityIds]
    );

    const dayIds: number[] = [];
    const imageLinks: Array<{ imageId: number; activityId: number; position: number }> = [];
    for (const day of input.days) {
        let dayId = day.dayId;
        if (dayId === undefined) {
            const inserted = await client.query<{ day_id: number }>(
                `INSERT INTO board_day (board_id, day_number, calendar_date)
                 VALUES ($1, $2, $3) RETURNING day_id`,
                [boardId, day.dayNumber, day.date]
            );
            dayId = inserted.rows[0]!.day_id;
        } else {
            await client.query(
                "UPDATE board_day SET day_number = $1, calendar_date = $2 WHERE day_id = $3",
                [day.dayNumber, day.date, dayId]
            );
        }
        dayIds.push(dayId);
        for (const activity of day.activities) {
            const locationId = activity.location ? locations.get(keyForLocation(activity.location)) : null;
            const external = activity.externalImage;
            const values = [day.dayNumber, activity.activityTime, boardId, activity.position,
                activity.title, activity.note, locationId, activity.category,
                activity.coverImageId === undefined
                    ? (activity.uploadedImageIds[0] ?? null) : activity.coverImageId,
                dayId, activity.source,
                activity.locationConfirmed, external?.provider ?? null,
                external?.providerImageId ?? null, external?.url ?? null,
                external?.photographer ?? null, external?.photographerUrl ?? null,
                external?.sourceUrl ?? null];
            let activityId = activity.activityId;
            if (activityId === undefined) {
                const inserted = await client.query<{ activity_id: number }>(
                    `INSERT INTO activity (day_number, activity_time, board_id, position, title, note,
                      location_id, type, cover_image_id, day_id, source, location_confirmed,
                      external_image_provider, external_image_id, external_image_url,
                      external_image_photographer, external_image_photographer_url, external_image_source_url)
                     VALUES (${values.map((_, index) => `$${index + 1}`).join(",")})
                     RETURNING activity_id`, values
                );
                activityId = inserted.rows[0]!.activity_id;
            } else {
                await client.query(
                    `UPDATE activity SET
                      day_number=$1, activity_time=$2, board_id=$3, position=$4, title=$5, note=$6,
                      location_id=$7, type=$8, cover_image_id=$9, day_id=$10, source=$11,
                      location_confirmed=$12, external_image_provider=$13, external_image_id=$14,
                      external_image_url=$15, external_image_photographer=$16,
                      external_image_photographer_url=$17, external_image_source_url=$18
                     WHERE activity_id=$19 AND board_id=$3`, [...values, activityId]
                );
            }
            activity.uploadedImageIds.forEach((imageId, position) =>
                imageLinks.push({ imageId, activityId, position }));
        }
    }
    await client.query(
        "DELETE FROM board_day WHERE board_id = $1 AND day_id <> ALL($2::int[])",
        [boardId, dayIds]
    );

    await client.query(
        `UPDATE uploaded_image i SET orphaned_at = NOW()
         FROM board_image bi
         WHERE bi.board_id = $1 AND bi.uploaded_image_id = i.uploaded_image_id
         AND i.uploaded_image_id <> ALL($2::int[])`, [boardId, input.imageIds]
    );
    await client.query("DELETE FROM board_image WHERE board_id = $1", [boardId]);
    if (input.imageIds.length) {
        await client.query(
            `INSERT INTO board_image (board_id, uploaded_image_id, position)
             SELECT $1, image_id, position - 1
             FROM UNNEST($2::int[]) WITH ORDINALITY AS image(image_id, position)`,
            [boardId, input.imageIds]
        );
        await client.query(
            "UPDATE uploaded_image SET orphaned_at = NULL WHERE uploaded_image_id = ANY($1::int[])",
            [input.imageIds]
        );
    }
    if (imageLinks.length) {
        await client.query(
            `INSERT INTO activity_image (uploaded_image_id, activity_id, position)
             SELECT * FROM UNNEST($1::int[], $2::int[], $3::int[])`,
            [imageLinks.map((link) => link.imageId), imageLinks.map((link) => link.activityId),
                imageLinks.map((link) => link.position)]
        );
    }
    await client.query("UPDATE board SET cover_image_id = $1 WHERE board_id = $2",
        [input.coverImageId === undefined ? (input.imageIds[0] ?? null) : input.coverImageId, boardId]);
}

async function readBoardDocument(
    client: PoolClient,
    boardId: number,
    userId: string | null | undefined
): Promise<BoardDocument | null> {
    const boardResult = await client.query<BoardRow>("SELECT * FROM board WHERE board_id = $1", [boardId]);
    const board = boardResult.rows[0];
    if (!board) return null;

    let permissions = { canEditContent: false, canManageBoard: false };
    if (userId !== undefined) {
        const accessResult = await client.query<{
            member_role: BoardAccess["memberRole"];
            is_friend: boolean;
        }>(
            `SELECT bm.role AS member_role,
              EXISTS (SELECT 1 FROM friendship f WHERE f.status = 'accepted' AND
                ((f.requester_user_id = $1 AND f.recipient_user_id = $2) OR
                 (f.recipient_user_id = $1 AND f.requester_user_id = $2))) AS is_friend
             FROM (SELECT $1::text AS owner_id) o
             LEFT JOIN board_member bm ON bm.board_id = $3 AND bm.user_id = $2`,
            [board.owner_user_id, userId, boardId]
        );
        const accessRow = accessResult.rows[0];
        const access: BoardAccess = {
            boardId: board.board_id,
            ownerUserId: board.owner_user_id,
            status: board.status,
            visibility: board.visibility,
            revision: board.revision,
            memberRole: accessRow?.member_role ?? null,
            isFriend: Boolean(accessRow?.is_friend)
        };
        if (!canReadBoard(access, userId)) {
            return null;
        }
        permissions = {
            canEditContent: access.ownerUserId === userId || (access.status === "published" && access.memberRole === "editor"),
            canManageBoard: access.ownerUserId === userId
        };
    }

    const tagResult = await client.query<{ tag_id: number; tag_name: string }>(
        `SELECT t.tag_id, t.tag_name FROM board_tag bt JOIN tag t ON t.tag_id = bt.tag_id
         WHERE bt.board_id = $1 ORDER BY t.tag_name`, [boardId]);
    const dayResult = await client.query<{ day_id: number; day_number: number; date: string | null }>(
        `SELECT day_id, day_number, to_char(calendar_date, 'YYYY-MM-DD') AS date
         FROM board_day WHERE board_id = $1 ORDER BY day_number`, [boardId]);
    const activityResult = await client.query<{
        activity_id: number; day_id: number | null; day_number: number; position: number;
        title: string; activity_time: string | null; note: string | null; type: string;
        source: "manual" | "mapbox" | "geoapify" | "photo";
        location_confirmed: boolean; cover_image_id: number | null;
        external_image_provider: string | null; external_image_id: string | null;
        external_image_url: string | null; external_image_photographer: string | null;
        external_image_photographer_url: string | null; external_image_source_url: string | null;
    } & LocationRow>(
        `SELECT a.*, l.name, l.latitude, l.longitude, l.address, l.city, l.country,
          l.external_place_id
         FROM activity a LEFT JOIN location l ON l.location_id = a.location_id
         WHERE a.board_id = $1 ORDER BY a.day_number, a.position, a.activity_id`, [boardId]);
    const imageResult = await client.query<{ uploaded_image_id: number; position: number; captured_at: Date | null }>(
        `SELECT bi.uploaded_image_id, bi.position, i.captured_at
         FROM board_image bi JOIN uploaded_image i ON i.uploaded_image_id = bi.uploaded_image_id
         WHERE bi.board_id = $1 ORDER BY bi.position`, [boardId]);
    const activityImageResult = await client.query<{ activity_id: number; uploaded_image_id: number; position: number }>(
        `SELECT ai.activity_id, ai.uploaded_image_id, ai.position
         FROM activity_image ai JOIN activity a ON a.activity_id = ai.activity_id
         WHERE a.board_id = $1 ORDER BY ai.activity_id, ai.position`, [boardId]);
    const activityImages = new Map<number, number[]>();
    for (const row of activityImageResult.rows) {
        const ids = activityImages.get(row.activity_id) ?? [];
        ids.push(row.uploaded_image_id);
        activityImages.set(row.activity_id, ids);
    }
    const dayMap = new Map<number, BoardDocument["days"][number]>();
    const days: BoardDocument["days"] = dayResult.rows.map((row) => {
        const day = { dayId: row.day_id, dayNumber: row.day_number,
            date: row.date, activities: [] as BoardDocument["days"][number]["activities"] };
        dayMap.set(row.day_id, day);
        return day;
    });
    for (const row of activityResult.rows) {
        const day = row.day_id === null ? undefined : dayMap.get(row.day_id);
        if (!day) continue;
        day.activities.push({
            activityId: row.activity_id, position: row.position, title: row.title,
            activityTime: row.activity_time?.slice(0, 5) ?? null,
            category: row.type, note: row.note, source: row.source,
            location: row.location_id === null ? null : locationFromRow(row),
            locationConfirmed: row.location_confirmed,
            uploadedImageIds: activityImages.get(row.activity_id) ?? [],
            coverImageId: row.cover_image_id,
            externalImage: row.external_image_provider === "unsplash" ? {
                provider: "unsplash", providerImageId: row.external_image_id!,
                url: row.external_image_url!, photographer: row.external_image_photographer!,
                photographerUrl: row.external_image_photographer_url,
                sourceUrl: row.external_image_source_url
            } : null
        });
    }
    return {
        boardId: board.board_id, revision: board.revision, status: board.status,
        title: board.title, description: board.description, visibility: board.visibility,
        isCompleted: board.is_completed, coverImageId: board.cover_image_id,
        tagIds: tagResult.rows.map((row) => row.tag_id),
        tags: tagResult.rows.map((row) => ({ tagId: row.tag_id, name: row.tag_name })),
        imageIds: imageResult.rows.map((row) => row.uploaded_image_id),
        images: imageResult.rows.map((row) => ({
            imageId: row.uploaded_image_id,
            url: imagePath(row.uploaded_image_id, "display"),
            thumbnailUrl: imagePath(row.uploaded_image_id, "thumbnail"),
            capturedAt: row.captured_at?.toISOString() ?? null,
            position: row.position
        })),
        days, createdAt: board.created_at.toISOString(), updatedAt: board.updated_at.toISOString(),
        permissions
    };
}

export function createBoardsRepository(): BoardRepository {
    return {
        async listTags() {
            const result = await getPool().query<{ tag_id: number; tag_name: string }>(
                "SELECT tag_id, tag_name FROM tag ORDER BY tag_name"
            );
            return result.rows.map((row) => ({ tagId: row.tag_id, name: row.tag_name }));
        },
        async listCategories() {
            const result = await getPool().query<{ type: string }>(
                "SELECT type FROM activity_type ORDER BY type"
            );
            return result.rows.map((row) => row.type);
        },
        async getAccess(boardId, userId) {
            const result = await getPool().query<{
                board_id: number; owner_user_id: string; status: BoardAccess["status"];
                visibility: BoardAccess["visibility"]; revision: number;
                member_role: BoardAccess["memberRole"]; is_friend: boolean;
            }>(
                `SELECT b.board_id, b.owner_user_id, b.status, b.visibility, b.revision,
                  bm.role AS member_role,
                  EXISTS (SELECT 1 FROM friendship f WHERE f.status = 'accepted' AND
                    ((f.requester_user_id = b.owner_user_id AND f.recipient_user_id = $2) OR
                     (f.recipient_user_id = b.owner_user_id AND f.requester_user_id = $2))) AS is_friend
                 FROM board b
                 LEFT JOIN board_member bm ON bm.board_id = b.board_id AND bm.user_id = $2
                 WHERE b.board_id = $1`, [boardId, userId]
            );
            const row = result.rows[0];
            return row ? {
                boardId: row.board_id, ownerUserId: row.owner_user_id, status: row.status,
                visibility: row.visibility, revision: row.revision,
                memberRole: row.member_role, isFriend: row.is_friend
            } : null;
        },
        async getBoard(boardId, userId = undefined) {
            const client = await getPool().connect();
            try {
                await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
                const document = await readBoardDocument(client, boardId, userId);
                await client.query("COMMIT");
                return document;
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        },
        async listDrafts(userId, page, limit) {
            const result = await getPool().query<{
                board_id: number; title: string; visibility: DraftSummary["visibility"];
                cover_image_id: number | null; updated_at: Date;
            }>(
                `SELECT board_id, title, visibility, cover_image_id, updated_at
                 FROM board WHERE owner_user_id = $1 AND status = 'draft'
                 ORDER BY updated_at DESC, board_id DESC LIMIT $2 OFFSET $3`,
                [userId, limit + 1, (page - 1) * limit]
            );
            return {
                items: result.rows.slice(0, limit).map((row) => ({
                    boardId: row.board_id, title: row.title, status: "draft" as const,
                    visibility: row.visibility,
                    coverImageUrl: row.cover_image_id === null ? null : imagePath(row.cover_image_id, "thumbnail"),
                    updatedAt: row.updated_at.toISOString()
                })),
                hasMore: result.rows.length > limit
            };
        },
        async listPublished(userId, page, limit) {
            const result = await getPool().query<{
                board_id: number; title: string; visibility: PublishedSummary["visibility"];
                cover_image_id: number | null; updated_at: Date;
            }>(
                `SELECT board_id, title, visibility, cover_image_id, updated_at
                 FROM board WHERE owner_user_id = $1 AND status = 'published'
                 ORDER BY updated_at DESC, board_id DESC LIMIT $2 OFFSET $3`,
                [userId, limit + 1, (page - 1) * limit]
            );
            return {
                items: result.rows.slice(0, limit).map((row) => ({
                    boardId: row.board_id, title: row.title, status: "published" as const,
                    visibility: row.visibility,
                    coverImageUrl: row.cover_image_id === null ? null : imagePath(row.cover_image_id, "thumbnail"),
                    updatedAt: row.updated_at.toISOString()
                })),
                hasMore: result.rows.length > limit
            };
        },
        async saveBoard(userId, boardId, expectedRevision, input) {
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                let savedId = boardId;
                if (savedId === null) {
                    const result = await client.query<{ board_id: number }>(
                        `INSERT INTO board (owner_user_id, title, description, visibility, status)
                         VALUES ($1, $2, $3, $4, $5) RETURNING board_id`,
                        [userId, input.title, input.description, input.visibility, input.status]
                    );
                    savedId = result.rows[0]!.board_id;
                } else {
                    const existing = await client.query<BoardRow>(
                        "SELECT * FROM board WHERE board_id = $1 FOR UPDATE", [savedId]
                    );
                    const row = existing.rows[0];
                    if (!row) throw new AppError(404, "Board not found", "NOT_FOUND");
                    const owner = row.owner_user_id === userId;
                    const membership = owner ? null : await client.query<{ role: string }>(
                        "SELECT role FROM board_member WHERE board_id = $1 AND user_id = $2",
                        [savedId, userId]
                    );
                    if (!owner && (row.status !== "published" || membership?.rows[0]?.role !== "editor")) {
                        throw new AppError(403, "Cannot edit this Board", "FORBIDDEN");
                    }
                    if (row.revision !== expectedRevision) {
                        throw new AppError(409, "Board changed in another session", "STALE_BOARD_REVISION");
                    }
                    if (row.status === "published" && input.status !== "published") {
                        throw new AppError(400, "A published Board cannot become a draft", "INVALID_REQUEST");
                    }
                    if (!owner && input.visibility !== row.visibility) {
                        throw new AppError(403, "Only the owner can change visibility", "FORBIDDEN");
                    }
                    await client.query(
                        `UPDATE board SET title=$1, description=$2, visibility=$3, status=$4,
                         revision=revision+1, updated_at=NOW(), cover_image_id=NULL WHERE board_id=$5`,
                        [input.title, input.description, input.visibility, input.status, savedId]
                    );
                }
                await writeChildren(client, savedId, userId, input);
                const document = await readBoardDocument(client, savedId, userId);
                if (!document) throw new Error("Saved Board could not be read");
                await client.query("COMMIT");
                return document;
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        },
        async deleteBoard(boardId, userId) {
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                const board = await client.query(
                    "SELECT board_id FROM board WHERE board_id = $1 AND owner_user_id = $2 FOR UPDATE",
                    [boardId, userId]
                );
                if (!board.rows.length) {
                    await client.query("ROLLBACK");
                    return false;
                }
                await client.query(
                    `UPDATE uploaded_image i SET orphaned_at = NOW()
                     WHERE i.uploaded_image_id IN (
                       SELECT uploaded_image_id FROM board_image WHERE board_id = $1
                       UNION SELECT cover_image_id FROM board WHERE board_id = $1
                       UNION SELECT a.cover_image_id FROM activity a WHERE a.board_id = $1
                       UNION SELECT ai.uploaded_image_id FROM activity_image ai
                         JOIN activity a ON a.activity_id = ai.activity_id WHERE a.board_id = $1
                     )`, [boardId]
                );
                await client.query("DELETE FROM board WHERE board_id = $1", [boardId]);
                await client.query("COMMIT");
                return true;
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        }
    };
}
