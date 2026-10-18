import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Client } from "pg";
import { closeDatabase, getPool } from "../src/db.js";
import { createAuthRepository } from "../src/features/auth/auth.repository.js";
import { createUsersRepository } from "../src/features/users/users.repository.js";
import { createImagesRepository } from "../src/features/images/images.repository.js";
import { createGooglePhotoImporter } from "../src/features/auth/auth.photo.js";
import type { ProviderAsset } from "../src/features/images/images.types.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

test(
    "Google account SQL allocates readable handles concurrently and protects customized profile defaults",
    {
        skip: databaseUrl ? undefined : "Database URL required"
    },
    async (context) => {
        const schema = `rb_auth_test_${randomBytes(6).toString("hex")}`;
        const admin = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 });
        const previousUrl = process.env.DATABASE_URL;
        await admin.connect();
        try {
            await admin.query(`CREATE SCHEMA ${schema}`);
            const url = new URL(databaseUrl!);
            url.searchParams.set("options", `-csearch_path=${schema}`);
            process.env.DATABASE_URL = url.toString();
            for (const migration of [
                "001_initial.sql",
                "002_auth_session.sql",
                "003_board_creator.sql",
                "004_api_features.sql",
                "005_image_library.sql",
                "006_profile.sql",
                "008_board_destination.sql",
                "009_image_presentation.sql",
                "010_guest_accounts.sql"
            ]) {
                await getPool().query(
                    await readFile(new URL(`../db/migrations/${migration}`, import.meta.url), "utf8")
                );
            }
            const authRepository = createAuthRepository();
            // Photo imports are completed into tracked orphan images before the auth transaction.
            const repository = {
                ...authRepository,
                async saveGoogleDefaults(...args: Parameters<typeof authRepository.saveGoogleDefaults>) {
                    const [userId, , , asset] = args;
                    if (asset)
                        await getPool().query(
                            `INSERT INTO uploaded_image (storage_key, uploaded_by_user_id, uploaded_at, byte_size, file_format)
                         VALUES ($1,$2,NOW(),$3,$4) ON CONFLICT (storage_key) DO NOTHING`,
                            [asset.storageKey, userId, asset.byteSize, asset.format]
                        );
                    return authRepository.saveGoogleDefaults(...args);
                }
            };
            const first = await repository.createUser({
                userId: "first",
                username: "ada_lovelace",
                displayName: "Ada"
            });
            assert.equal(first?.username, "ada_lovelace");
            const others = await Promise.all(
                Array.from({ length: 4 }, (_, index) =>
                    repository.createUser({
                        userId: `other-${index}`,
                        username: "ada_lovelace",
                        displayName: "Ada Lovelace"
                    })
                )
            );
            assert.deepEqual(others.map((user) => user?.username).sort(), [
                "ada_lovelace_1",
                "ada_lovelace_2",
                "ada_lovelace_3",
                "ada_lovelace_4"
            ]);
            const repeated = await repository.createUser({
                userId: "first",
                username: "ada_lovelace",
                displayName: "Changed"
            });
            assert.equal(repeated, null);
            assert.equal((await repository.findUserById("first"))?.username, "ada_lovelace");

            await repository.createUser({ userId: "old", username: "ada_lovelace_ab12345678", displayName: "Ada" });
            await repository.createUser({
                userId: "old-second",
                username: "ada_lovelace_1234abcdef",
                displayName: "Ada"
            });
            await Promise.all([
                repository.saveGoogleDefaults("old", "Ada", "Ada Lovelace", undefined, "ada_lovelace"),
                repository.saveGoogleDefaults("old-second", "Ada", "Ada Lovelace", undefined, "ada_lovelace")
            ]);
            const renamed = await Promise.all([repository.findUserById("old"), repository.findUserById("old-second")]);
            assert.deepEqual(renamed.map((user) => user?.username).sort(), ["ada_lovelace_5", "ada_lovelace_6"]);
            await repository.saveGoogleDefaults("old", "Ada", "Ada Lovelace", undefined, "ada_lovelace");
            assert.deepEqual(
                await repository.findUserById("old"),
                renamed[0],
                "A readable handle stays stable on later logins"
            );
            await repository.createUser({ userId: "custom", username: "countess_ada", displayName: "Countess" });
            await repository.saveGoogleDefaults("custom", "Ada", "Ada Lovelace", undefined, "ada_lovelace");
            assert.equal((await repository.findUserById("custom"))?.username, "countess_ada");

            const photo: ProviderAsset = {
                storageKey: "roamboard/uploads/first-google",
                format: "jpg",
                byteSize: 500,
                createdAt: new Date(),
                capturedAt: null,
                latitude: null,
                longitude: null
            };
            await repository.saveGoogleDefaults("first", "Ada", "Ada Lovelace", photo);
            const defaulted = await repository.findUserById("first");
            assert.equal(defaulted?.displayName, "Ada Lovelace");
            assert.match(defaulted?.profilePictureUrl ?? "", /^\/api\/v1\/images\/\d+\/content\?variant=thumbnail$/);
            await getPool().query("UPDATE app_user SET display_name='Countess Ada' WHERE user_id='first'");
            await repository.saveGoogleDefaults("first", "Ada", "Ada Lovelace", {
                ...photo,
                storageKey: "roamboard/uploads/concurrent-google"
            });
            const customized = await repository.findUserById("first");
            assert.equal(customized?.displayName, "Countess Ada");
            assert.equal(customized?.profilePictureUrl, defaulted?.profilePictureUrl);
            const concurrentAsset = await getPool().query(
                "SELECT orphaned_at FROM uploaded_image WHERE storage_key=$1",
                ["roamboard/uploads/concurrent-google"]
            );
            assert.ok(concurrentAsset.rows[0]?.orphaned_at, "An unused concurrent import remains eligible for cleanup");
            await repository.createSession("session-hash", "first", new Date(Date.now() + 60_000));
            assert.deepEqual(await repository.findUserBySession("session-hash"), customized);

            assert.equal(await repository.findGooglePhotoStorageKey("first"), photo.storageKey);
            await getPool().query(
                `INSERT INTO image_upload_intent (upload_id, user_id, storage_key, file_name, content_type, size_bytes, expires_at, uploaded_image_id)
                SELECT '00000000-0000-4000-8000-000000000001', 'first', storage_key, 'custom.jpg', 'image/jpeg', 500, NOW() + INTERVAL '1 hour', uploaded_image_id
                FROM uploaded_image WHERE storage_key=$1`,
                [photo.storageKey]
            );
            assert.equal(
                await repository.findGooglePhotoStorageKey("first"),
                null,
                "A user-selected upload is excluded from Google repair"
            );
            await getPool().query(
                "DELETE FROM image_upload_intent WHERE upload_id='00000000-0000-4000-8000-000000000001'"
            );
            const repairedPhoto = { ...photo, storageKey: "roamboard/google-profile/repaired" };
            await repository.saveGoogleDefaults(
                "first",
                "Ada",
                "Ada Lovelace",
                repairedPhoto,
                "ada_lovelace",
                photo.storageKey
            );
            const repaired = await repository.findUserById("first");
            assert.notEqual(repaired?.profilePictureUrl, customized?.profilePictureUrl);
            assert.equal(
                await repository.findGooglePhotoStorageKey("first"),
                null,
                "A high-resolution import does not need repair again"
            );
            assert.equal(repaired?.displayName, "Countess Ada");
            const oldAsset = await getPool().query("SELECT orphaned_at FROM uploaded_image WHERE storage_key=$1", [
                photo.storageKey
            ]);
            assert.ok(oldAsset.rows[0]?.orphaned_at, "The replaced low-resolution photo is eligible for cleanup");
            await repository.saveGoogleDefaults(
                "first",
                "Ada",
                "Ada Lovelace",
                { ...photo, storageKey: "roamboard/google-profile/stale-repair" },
                "ada_lovelace",
                photo.storageKey
            );
            assert.equal(
                (await repository.findUserById("first"))?.profilePictureUrl,
                repaired?.profilePictureUrl,
                "A stale repair cannot overwrite the user's newer photo"
            );

            // The import starts with a photo, but its removal finishes before the download is saved.
            await createUsersRepository().setPicture("first", null);
            const removed = await repository.findUserById("first");
            const removedRevision = await getPool().query("SELECT profile_revision FROM app_user WHERE user_id=$1", [
                "first"
            ]);
            const latePhoto = { ...photo, storageKey: "roamboard/google-profile/removed-during-import" };
            await repository.saveGoogleDefaults(
                "first",
                "Ada",
                "Ada Lovelace",
                latePhoto,
                "ada_lovelace",
                repairedPhoto.storageKey
            );
            assert.equal(removed?.profilePictureUrl, null);
            assert.deepEqual(
                await repository.findUserById("first"),
                removed,
                "A completed photo removal must not be undone by the in-flight replacement"
            );
            const afterRemoval = await getPool().query("SELECT profile_revision FROM app_user WHERE user_id=$1", [
                "first"
            ]);
            assert.equal(afterRemoval.rows[0].profile_revision, removedRevision.rows[0].profile_revision);
            const lateAsset = await getPool().query("SELECT orphaned_at FROM uploaded_image WHERE storage_key=$1", [
                latePhoto.storageKey
            ]);
            assert.ok(lateAsset.rows[0]?.orphaned_at, "The discarded replacement remains eligible for cleanup");

            const images = createImagesRepository();
            const importer = createGooglePhotoImporter(
                {
                    async inspect() {
                        return null;
                    },
                    authorizeUpload(storageKey) {
                        return {
                            uploadUrl: "https://upload.example.test/image",
                            method: "POST" as const,
                            headers: {},
                            formFields: { public_id: storageKey }
                        };
                    }
                },
                images
            );
            let timeout = true;
            let uploadKey = "";
            context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
                if (String(input).startsWith("https://lh3.googleusercontent.com/")) {
                    return new Response("photo", { headers: { "content-type": "image/jpeg" } });
                }
                uploadKey = String((init?.body as FormData).get("public_id"));
                const tracked = await getPool().query(
                    "SELECT upload_id FROM image_upload_intent WHERE storage_key=$1",
                    [uploadKey]
                );
                assert.equal(tracked.rows.length, 1, "The provider must never receive an untracked upload");
                if (timeout) throw new Error("Upload response timed out after file was stored");
                return Response.json({
                    public_id: uploadKey,
                    bytes: 5,
                    format: "jpg",
                    created_at: new Date().toISOString()
                });
            });
            await assert.rejects(
                importer("https://lh3.googleusercontent.com/a/photo", undefined, "first"),
                /timed out/
            );
            const failedIntent = await getPool().query(
                "SELECT upload_id, uploaded_image_id FROM image_upload_intent WHERE storage_key=$1",
                [uploadKey]
            );
            assert.equal(failedIntent.rows[0].uploaded_image_id, null);
            await getPool().query(
                "UPDATE image_upload_intent SET created_at=NOW()-INTERVAL '3 days', expires_at=NOW()-INTERVAL '2 days' WHERE upload_id=$1",
                [failedIntent.rows[0].upload_id]
            );
            assert.ok(
                (await images.listCleanupCandidates(new Date(), 100)).some(
                    (item) => item.uploadId === failedIntent.rows[0].upload_id
                )
            );
            let destroyed = false;
            assert.equal(
                await images.cleanupIntent(failedIntent.rows[0].upload_id, async () => {
                    destroyed = true;
                }),
                true
            );
            assert.equal(destroyed, true, "An ambiguous provider timeout must remain recoverable by cleanup");

            timeout = false;
            const completedPhoto = await importer("https://lh3.googleusercontent.com/a/photo", undefined, "first");
            assert.ok(completedPhoto);
            // Fail after the image is linked inside the transaction, forcing the entire profile save to roll back.
            await assert.rejects(
                authRepository.saveGoogleDefaults("first", "Countess Ada", "x".repeat(501), completedPhoto)
            );
            const afterRollback = await getPool().query(
                `SELECT i.uploaded_image_id, i.orphaned_at, intent.uploaded_image_id AS intent_image_id
                 FROM uploaded_image i JOIN image_upload_intent intent ON intent.storage_key=i.storage_key WHERE i.storage_key=$1`,
                [completedPhoto.storageKey]
            );
            assert.ok(afterRollback.rows[0].orphaned_at, "A rolled-back profile save must retain the tracked orphan");
            assert.equal(afterRollback.rows[0].uploaded_image_id, afterRollback.rows[0].intent_image_id);
            assert.equal((await authRepository.findUserById("first"))?.profilePictureUrl, null);
            await getPool().query(
                "UPDATE uploaded_image SET orphaned_at=NOW()-INTERVAL '2 days' WHERE storage_key=$1",
                [completedPhoto.storageKey]
            );
            assert.ok(
                (await images.listCleanupCandidates(new Date(), 100)).some(
                    (item) => item.imageId === afterRollback.rows[0].uploaded_image_id
                )
            );
            await authRepository.saveGoogleDefaults("first", "Ada", "Ada Lovelace", completedPhoto);
            assert.ok((await authRepository.findUserById("first"))?.profilePictureUrl);
            assert.ok(
                !(await images.listCleanupCandidates(new Date(), 100)).some(
                    (item) => item.storageKey === completedPhoto.storageKey
                ),
                "A successfully linked import must not be cleaned up"
            );
        } finally {
            await closeDatabase();
            if (previousUrl === undefined) delete process.env.DATABASE_URL;
            else process.env.DATABASE_URL = previousUrl;
            await admin.query(`DROP SCHEMA ${schema} CASCADE`);
            await admin.end();
        }
    }
);
