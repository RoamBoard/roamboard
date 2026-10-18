import { getPool } from "../../db.js";
import { AppError } from "../../shared/app-error.js";
import type { ImagesRepository, ProviderAsset, UploadIntent } from "./images.types.js";

interface IntentRow {
    upload_id: string;
    user_id: string;
    storage_key: string;
    file_name: string;
    content_type: string;
    size_bytes: number;
    created_at: Date;
    expires_at: Date;
    uploaded_image_id: number | null;
}

function intentFromRow(row: IntentRow): UploadIntent {
    return {
        uploadId: row.upload_id,
        userId: row.user_id,
        storageKey: row.storage_key,
        fileName: row.file_name,
        contentType: row.content_type,
        sizeBytes: row.size_bytes,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        imageId: row.uploaded_image_id
    };
}

const unreferenced = `NOT EXISTS (SELECT 1 FROM board_image bi WHERE bi.uploaded_image_id = i.uploaded_image_id)
  AND NOT EXISTS (SELECT 1 FROM activity_image ai WHERE ai.uploaded_image_id = i.uploaded_image_id)
  AND NOT EXISTS (SELECT 1 FROM board b WHERE b.cover_image_id = i.uploaded_image_id)
  AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.cover_image_id = i.uploaded_image_id)
  AND NOT EXISTS (SELECT 1 FROM app_user u WHERE u.profile_picture_image_id = i.uploaded_image_id)`;

export function createImagesRepository(): ImagesRepository {
    return {
        async createIntent(intent) {
            await getPool().query(
                `INSERT INTO image_upload_intent
                 (upload_id, user_id, storage_key, file_name, content_type, size_bytes, created_at, expires_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [
                    intent.uploadId,
                    intent.userId,
                    intent.storageKey,
                    intent.fileName,
                    intent.contentType,
                    intent.sizeBytes,
                    intent.createdAt,
                    intent.expiresAt
                ]
            );
        },
        async findIntent(uploadId) {
            const result = await getPool().query<IntentRow>("SELECT * FROM image_upload_intent WHERE upload_id = $1", [
                uploadId
            ]);
            return result.rows[0] ? intentFromRow(result.rows[0]) : null;
        },
        async completeIntent(intent: UploadIntent, asset: ProviderAsset) {
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                const result = await client.query<IntentRow>(
                    "SELECT * FROM image_upload_intent WHERE upload_id = $1 FOR UPDATE",
                    [intent.uploadId]
                );
                const current = result.rows[0];
                if (!current || current.user_id !== intent.userId || current.storage_key !== asset.storageKey) {
                    throw new AppError(404, "Upload not found", "NOT_FOUND");
                }
                if (current.uploaded_image_id !== null) {
                    await client.query("COMMIT");
                    return current.uploaded_image_id;
                }
                if (current.expires_at <= new Date()) {
                    throw new AppError(409, "Upload authorization expired", "UPLOAD_EXPIRED");
                }
                const image = await client.query<{ uploaded_image_id: number }>(
                    `INSERT INTO uploaded_image
                     (storage_key, uploaded_by_user_id, captured_at, uploaded_at,
                      byte_size, file_format, latitude, longitude)
                     VALUES ($1,$2,$3,NOW()::timestamp,$4,$5,$6,$7)
                     RETURNING uploaded_image_id`,
                    [
                        asset.storageKey,
                        intent.userId,
                        asset.capturedAt,
                        asset.byteSize,
                        asset.format,
                        asset.latitude,
                        asset.longitude
                    ]
                );
                const imageId = image.rows[0]!.uploaded_image_id;
                await client.query("UPDATE image_upload_intent SET uploaded_image_id = $1 WHERE upload_id = $2", [
                    imageId,
                    intent.uploadId
                ]);
                await client.query("COMMIT");
                return imageId;
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        },
        async findImage(imageId) {
            const result = await getPool().query<{
                uploaded_image_id: number;
                storage_key: string;
                uploaded_by_user_id: string;
                board_id: number | null;
                presentation_edit: import("./images.schemas.js").ImagePresentationEdit | null;
                presentation_revision: number;
                // The current profile link determines whose avatar this image is.
                profile_owner_user_id: string | null;
                profile_owner_username: string | null;
                captured_at: Date | null;
                latitude: string | null;
                longitude: string | null;
            }>(
                `SELECT i.uploaded_image_id, i.storage_key, i.uploaded_by_user_id,
                  bi.board_id, i.captured_at, i.latitude, i.longitude,i.presentation_edit,i.presentation_revision,
                  profile_owner.user_id AS profile_owner_user_id,
                  profile_owner.username AS profile_owner_username
                 FROM uploaded_image i
                 LEFT JOIN board_image bi ON bi.uploaded_image_id = i.uploaded_image_id
                 LEFT JOIN app_user profile_owner ON profile_owner.profile_picture_image_id = i.uploaded_image_id
                 WHERE i.uploaded_image_id = $1`,
                [imageId]
            );
            const row = result.rows[0];
            return row
                ? {
                      imageId: row.uploaded_image_id,
                      storageKey: row.storage_key,
                      uploaderUserId: row.uploaded_by_user_id,
                      boardId: row.board_id,
                      presentationEdit: row.presentation_edit,
                      presentationRevision: row.presentation_revision,
                      profileOwnerUserId: row.profile_owner_user_id,
                      profileOwnerUsername: row.profile_owner_username,
                      capturedAt: row.captured_at,
                      latitude: row.latitude === null ? null : Number(row.latitude),
                      longitude: row.longitude === null ? null : Number(row.longitude)
                  }
                : null;
        },
        async savePresentation(imageId, userId, revision, edit) {
            const result = await getPool().query(
                "UPDATE uploaded_image SET presentation_edit=$1,presentation_revision=presentation_revision+1 WHERE uploaded_image_id=$2 AND uploaded_by_user_id=$3 AND presentation_revision=$4",
                [edit === null ? null : JSON.stringify(edit), imageId, userId, revision]
            );
            return result.rowCount === 1;
        },
        async updateMetadata(imageId, asset) {
            await getPool().query(
                "UPDATE uploaded_image SET captured_at=$1,latitude=$2,longitude=$3 WHERE uploaded_image_id=$4",
                [asset.capturedAt, asset.latitude, asset.longitude, imageId]
            );
        },
        async findImages(imageIds) {
            const result = await getPool().query<{
                uploaded_image_id: number;
                storage_key: string;
                uploaded_by_user_id: string;
                board_id: number | null;
                captured_at: Date | null;
                latitude: string | null;
                longitude: string | null;
            }>(
                "SELECT i.uploaded_image_id,i.storage_key,i.uploaded_by_user_id,bi.board_id,i.captured_at,i.latitude,i.longitude FROM uploaded_image i LEFT JOIN board_image bi ON bi.uploaded_image_id=i.uploaded_image_id WHERE i.uploaded_image_id=ANY($1::int[])",
                [imageIds]
            );
            return result.rows.map((row) => ({
                imageId: row.uploaded_image_id,
                storageKey: row.storage_key,
                uploaderUserId: row.uploaded_by_user_id,
                boardId: row.board_id,
                capturedAt: row.captured_at,
                latitude: row.latitude === null ? null : Number(row.latitude),
                longitude: row.longitude === null ? null : Number(row.longitude)
            }));
        },
        async listCleanupCandidates(before, limit) {
            const result = await getPool().query<{
                image_id: number | null;
                storage_key: string;
                upload_id: string | null;
            }>(
                `SELECT i.uploaded_image_id AS image_id, i.storage_key, NULL::uuid AS upload_id
                 FROM uploaded_image i
                 WHERE i.orphaned_at < $1 AND ${unreferenced}
                 UNION ALL
                 SELECT NULL::int AS image_id, ui.storage_key, ui.upload_id
                 FROM image_upload_intent ui
                 WHERE ui.uploaded_image_id IS NULL AND ui.expires_at < $1
                 LIMIT $2`,
                [before, limit]
            );
            return result.rows.map((row) => ({
                imageId: row.image_id,
                storageKey: row.storage_key,
                uploadId: row.upload_id
            }));
        },
        async cleanupImage(imageId, removeAsset) {
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                const row = await client.query<{ storage_key: string }>(
                    `SELECT i.storage_key FROM uploaded_image i
                     WHERE i.uploaded_image_id = $1 AND i.orphaned_at < NOW() - INTERVAL '24 hours'
                     AND ${unreferenced} FOR UPDATE OF i SKIP LOCKED`,
                    [imageId]
                );
                if (!row.rows[0]) {
                    await client.query("ROLLBACK");
                    return false;
                }
                await removeAsset();
                await client.query("DELETE FROM uploaded_image WHERE uploaded_image_id = $1", [imageId]);
                await client.query("COMMIT");
                return true;
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        },
        async cleanupIntent(uploadId, removeAsset) {
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                const row = await client.query<{ upload_id: string }>(
                    `SELECT upload_id FROM image_upload_intent
                     WHERE upload_id = $1 AND uploaded_image_id IS NULL
                     AND expires_at < NOW() - INTERVAL '24 hours'
                     FOR UPDATE SKIP LOCKED`,
                    [uploadId]
                );
                if (!row.rows[0]) {
                    await client.query("ROLLBACK");
                    return false;
                }
                await removeAsset();
                await client.query("DELETE FROM image_upload_intent WHERE upload_id = $1", [uploadId]);
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
