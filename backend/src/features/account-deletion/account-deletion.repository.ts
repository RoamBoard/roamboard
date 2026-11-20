import type { PoolClient } from "pg";

import { getPool } from "../../db.js";
import { AppError } from "../../shared/app-error.js";
import { collectOwnedBoardLocationIds, removeUnreferencedLocations } from "../boards/board-locations.repository.js";

const unreferenced = `NOT EXISTS (SELECT 1 FROM board_image bi WHERE bi.uploaded_image_id = i.uploaded_image_id)
    AND NOT EXISTS (SELECT 1 FROM activity_image ai WHERE ai.uploaded_image_id = i.uploaded_image_id)
    AND NOT EXISTS (SELECT 1 FROM board b WHERE b.cover_image_id = i.uploaded_image_id)
    AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.cover_image_id = i.uploaded_image_id)
    AND NOT EXISTS (SELECT 1 FROM app_user u WHERE u.profile_picture_image_id = i.uploaded_image_id)`;

export interface AccountDeletionRepository {
    deleteAccount(userId: string): Promise<void>;
}

async function deleteWithinTransaction(client: PoolClient, userId: string): Promise<void> {
    const account = await client.query<{ is_guest: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM guest_account g WHERE g.user_id=u.user_id) AS is_guest
         FROM app_user u WHERE u.user_id=$1 FOR UPDATE OF u`,
        [userId]
    );
    if (!account.rows[0]) throw new AppError(401, "Not signed in", "UNAUTHENTICATED");
    if (account.rows[0].is_guest)
        throw new AppError(403, "Account deletion is unavailable for this account", "ACCOUNT_DELETION_UNAVAILABLE");

    const browsers = await client.query<{ browser_id: string }>(
        "SELECT browser_id FROM board_browser WHERE user_id=$1 FOR UPDATE",
        [userId]
    );
    const browserKeys = browsers.rows.map((row) => `g:${row.browser_id}`);
    const userKey = `u:${userId}`;
    await client.query("DELETE FROM board_view_challenge WHERE viewer_key=$1 OR viewer_key=ANY($2::text[])", [
        userKey,
        browserKeys
    ]);
    await client.query("DELETE FROM board_view WHERE viewer_key=$1 OR viewer_key=ANY($2::text[])", [
        userKey,
        browserKeys
    ]);

    const locationIds = await collectOwnedBoardLocationIds(client, userId);

    // Incomplete uploads can still arrive through a previously issued provider signature.
    // Keep their storage keys until the existing expiry grace period has passed.
    await client.query(
        `INSERT INTO account_asset_cleanup (storage_key, eligible_at)
         SELECT storage_key, GREATEST(NOW(), expires_at + INTERVAL '24 hours')
         FROM image_upload_intent WHERE user_id=$1 AND uploaded_image_id IS NULL
           AND NOT starts_with(storage_key, 'roamboard/editorial/')
         ON CONFLICT (storage_key) DO NOTHING`,
        [userId]
    );
    const images = await client.query<{ uploaded_image_id: number }>(
        "SELECT uploaded_image_id FROM uploaded_image WHERE uploaded_by_user_id=$1 FOR UPDATE",
        [userId]
    );
    const imageIds = images.rows.map((row) => row.uploaded_image_id);

    // Existing Boards may have shared image rows. Remove the uploader's private EXIF
    // fields without changing the rendered crop on a surviving Board.
    await client.query(
        "UPDATE uploaded_image SET captured_at=NULL, latitude=NULL, longitude=NULL WHERE uploaded_by_user_id=$1",
        [userId]
    );
    await client.query("DELETE FROM app_user WHERE user_id=$1", [userId]);

    // Location rows are shared across Boards and have no owner foreign key.
    // Remove only those used by this account that have no surviving references.
    await removeUnreferencedLocations(client, locationIds);

    // Board/profile cascades have now removed the account's saved image references.
    // Move unreferenced assets into a provider-only queue, then remove their image rows.
    await client.query(
        `INSERT INTO account_asset_cleanup (storage_key)
         SELECT i.storage_key FROM uploaded_image i
         WHERE i.uploaded_image_id=ANY($1::int[])
           AND NOT starts_with(i.storage_key, 'roamboard/editorial/')
           AND ${unreferenced}
         ON CONFLICT (storage_key) DO NOTHING`,
        [imageIds]
    );
    await client.query(
        `DELETE FROM uploaded_image i
         WHERE i.uploaded_image_id=ANY($1::int[]) AND ${unreferenced}`,
        [imageIds]
    );
}

export function createAccountDeletionRepository(): AccountDeletionRepository {
    return {
        async deleteAccount(userId) {
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                await deleteWithinTransaction(client, userId);
                await client.query("COMMIT");
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        }
    };
}
