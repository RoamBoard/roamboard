import type { PoolClient } from "pg";

import { getPool } from "../../db.js";
import type { AppUser, AuthRepository } from "./auth.types.js";

interface UserRow {
    user_id: string;
    username: string;
    display_name: string;
    profile_picture_image_id: number | null;
}

function toUser(row: UserRow): AppUser {
    return {
        userId: row.user_id,
        username: row.username,
        displayName: row.display_name,
        profilePictureUrl: row.profile_picture_image_id
            ? `/api/v1/images/${row.profile_picture_image_id}/content?variant=thumbnail`
            : null
    };
}

async function availableUsername(client: PoolClient, base: string): Promise<string> {
    const taken = await client.query<{ username: string }>(
        "SELECT username FROM app_user WHERE username=$1 OR starts_with(username, $1 || '_')",
        [base]
    );
    const handles = new Set(taken.rows.map((row) => row.username));
    let username = base;
    for (let suffix = 1; handles.has(username); suffix += 1) username = base + "_" + suffix;
    return username;
}

export function createAuthRepository(): AuthRepository {
    return {
        async listGuestAccounts() {
            const result = await getPool().query<UserRow>(
                `SELECT u.user_id, u.username, u.display_name, u.profile_picture_image_id
                 FROM guest_account g JOIN app_user u ON u.user_id=g.user_id
                 ORDER BY lower(u.username), u.user_id`
            );
            return result.rows.map(toUser);
        },
        async createGuestAccount(userId, username) {
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                const result = await client.query<UserRow>(
                    `INSERT INTO app_user (user_id, username, display_name)
                     VALUES ($1, $2, $2)
                     RETURNING user_id, username, display_name, profile_picture_image_id`,
                    [userId, username]
                );
                await client.query("INSERT INTO guest_account (user_id) VALUES ($1)", [userId]);
                await client.query("COMMIT");
                if (!result.rows[0]) throw new Error("Guest account insert returned no user");
                return toUser(result.rows[0]);
            } catch (error) {
                await client.query("ROLLBACK");
                if ((error as { code?: string }).code === "23505") return null;
                throw error;
            } finally {
                client.release();
            }
        },
        async findGuestAccount(userId) {
            const result = await getPool().query<UserRow>(
                `SELECT u.user_id, u.username, u.display_name, u.profile_picture_image_id
                 FROM guest_account g JOIN app_user u ON u.user_id=g.user_id WHERE g.user_id=$1`,
                [userId]
            );
            return result.rows[0] ? toUser(result.rows[0]) : null;
        },
        async findUserById(userId) {
            const result = await getPool().query<UserRow>(
                "SELECT user_id, username, display_name, profile_picture_image_id FROM app_user WHERE user_id = $1",
                [userId]
            );
            return result.rows[0] ? toUser(result.rows[0]) : null;
        },
        async findGooglePhotoStorageKey(userId) {
            const result = await getPool().query<{ storage_key: string }>(
                `SELECT i.storage_key FROM app_user u JOIN uploaded_image i ON i.uploaded_image_id=u.profile_picture_image_id
                 WHERE u.user_id=$1 AND NOT starts_with(i.storage_key, 'roamboard/google-profile/')
                 AND NOT EXISTS (SELECT 1 FROM image_upload_intent intent WHERE intent.uploaded_image_id=i.uploaded_image_id)`,
                [userId]
            );
            return result.rows[0]?.storage_key ?? null;
        },
        async createUser(user) {
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                // Serialize matching bases; the unique constraint also protects manual handle edits.
                await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [user.username]);
                const username = await availableUsername(client, user.username);
                const result = await client.query<UserRow>(
                    `INSERT INTO app_user (user_id, username, display_name)
                     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
                     RETURNING user_id, username, display_name, profile_picture_image_id`,
                    [user.userId, username, user.displayName]
                );
                await client.query("COMMIT");
                return result.rows[0] ? toUser(result.rows[0]) : null;
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        },
        async saveGoogleDefaults(
            userId,
            previousDefaultName,
            fullName,
            asset,
            generatedUsernameBase,
            previousPhotoStorageKey
        ) {
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                if (generatedUsernameBase) {
                    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
                        generatedUsernameBase
                    ]);
                }
                const current = await client.query<UserRow>(
                    "SELECT user_id, username, display_name, profile_picture_image_id FROM app_user WHERE user_id=$1 FOR UPDATE",
                    [userId]
                );
                const user = current.rows[0];
                if (user) {
                    if (
                        generatedUsernameBase &&
                        user.username.startsWith(generatedUsernameBase + "_") &&
                        /^[a-f0-9]{10}$/.test(user.username.slice(generatedUsernameBase.length + 1))
                    ) {
                        // Handle edits also use the unique constraint; retry if an edit claims our candidate.
                        for (let attempt = 0; attempt < 5; attempt += 1) {
                            await client.query("SAVEPOINT rename_handle");
                            try {
                                const username = await availableUsername(client, generatedUsernameBase);
                                await client.query(
                                    "UPDATE app_user SET username=$2, profile_revision=profile_revision+1, updated_at=NOW() WHERE user_id=$1",
                                    [userId, username]
                                );
                                await client.query("RELEASE SAVEPOINT rename_handle");
                                break;
                            } catch (error) {
                                await client.query("ROLLBACK TO SAVEPOINT rename_handle");
                                if ((error as { code?: string }).code !== "23505" || attempt === 4) throw error;
                            }
                        }
                    }
                    let imageId = user.profile_picture_image_id;
                    const previousImage =
                        previousPhotoStorageKey && imageId !== null
                            ? await client.query(
                                  "SELECT uploaded_image_id FROM uploaded_image WHERE uploaded_image_id=$1 AND storage_key=$2",
                                  [imageId, previousPhotoStorageKey]
                              )
                            : null;
                    const replacePhoto = previousPhotoStorageKey
                        ? Boolean(previousImage?.rows.length)
                        : imageId === null;
                    if (asset) {
                        const tracked = await client.query<{ uploaded_image_id: number }>(
                            "SELECT uploaded_image_id FROM uploaded_image WHERE storage_key=$1 AND uploaded_by_user_id=$2 FOR UPDATE",
                            [asset.storageKey, userId]
                        );
                        const importedImageId = tracked.rows[0]?.uploaded_image_id;
                        if (importedImageId === undefined) throw new Error("Imported profile image is not tracked");
                        if (replacePhoto) {
                            await client.query(
                                "UPDATE uploaded_image SET orphaned_at=NULL WHERE uploaded_image_id=$1",
                                [importedImageId]
                            );
                            if (imageId !== null)
                                await client.query(
                                    "UPDATE uploaded_image SET orphaned_at=NOW() WHERE uploaded_image_id=$1",
                                    [imageId]
                                );
                            imageId = importedImageId;
                        }
                    }
                    if (
                        (user.display_name === previousDefaultName && user.display_name !== fullName) ||
                        imageId !== user.profile_picture_image_id
                    ) {
                        await client.query(
                            `UPDATE app_user SET display_name=CASE WHEN display_name=$2 THEN $3 ELSE display_name END,
                             profile_picture_image_id=$4, profile_revision=profile_revision+1, updated_at=NOW() WHERE user_id=$1`,
                            [userId, previousDefaultName, fullName, imageId]
                        );
                    }
                }
                await client.query("COMMIT");
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        },
        async createSession(tokenHash, userId, expiresAt) {
            await getPool().query("INSERT INTO auth_session (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [
                tokenHash,
                userId,
                expiresAt
            ]);
        },
        async findUserBySession(tokenHash) {
            const result = await getPool().query<UserRow>(
                `SELECT u.user_id, u.username, u.display_name, u.profile_picture_image_id
         FROM auth_session AS s
         JOIN app_user AS u ON u.user_id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
                [tokenHash]
            );
            return result.rows[0] ? toUser(result.rows[0]) : null;
        },
        async deleteSession(tokenHash) {
            await getPool().query("DELETE FROM auth_session WHERE token_hash = $1", [tokenHash]);
        }
    };
}
