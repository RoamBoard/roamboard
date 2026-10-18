import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Client } from "pg";
import { closeDatabase, getPool } from "../src/db.js";
import { createAuthRepository } from "../src/features/auth/auth.repository.js";
import type { ProviderAsset } from "../src/features/images/images.types.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

test(
    "Google account SQL allocates readable handles concurrently and protects customized profile defaults",
    {
        skip: databaseUrl ? undefined : "Database URL required"
    },
    async () => {
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
                "006_profile.sql"
            ]) {
                await getPool().query(
                    await readFile(new URL(`../db/migrations/${migration}`, import.meta.url), "utf8")
                );
            }
            const repository = createAuthRepository();
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
        } finally {
            await closeDatabase();
            if (previousUrl === undefined) delete process.env.DATABASE_URL;
            else process.env.DATABASE_URL = previousUrl;
            await admin.query(`DROP SCHEMA ${schema} CASCADE`);
            await admin.end();
        }
    }
);
