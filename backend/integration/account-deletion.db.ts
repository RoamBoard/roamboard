import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Readable } from "node:stream";
import test from "node:test";

import { Client } from "pg";
import request from "supertest";

import { createApp } from "../src/app.js";
import { closeDatabase, getPool } from "../src/db.js";
import { createBoardsRepository } from "../src/features/boards/boards.repository.js";
import { createImageCleanup } from "../src/features/images/images.cleanup.js";
import { createImagesRepository } from "../src/features/images/images.repository.js";
import { createImagesService } from "../src/features/images/images.service.js";
import type { ImageProvider } from "../src/features/images/images.types.js";
import { sessionCookieName } from "../src/shared/session-cookie.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const origin = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";

test(
    "account deletion rolls back on failure, removes dependent rows, and retries provider cleanup",
    { skip: databaseUrl ? undefined : "TEST_DATABASE_URL or DATABASE_URL is required" },
    async () => {
        const schema = `rb_account_delete_${randomBytes(6).toString("hex")}`;
        const admin = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 });
        const previousUrl = process.env.DATABASE_URL;
        await admin.connect();
        try {
            await admin.query(`CREATE SCHEMA ${schema}`);
            const url = new URL(databaseUrl!);
            url.searchParams.set("options", `-csearch_path=${schema}`);
            process.env.DATABASE_URL = url.toString();
            const pool = getPool();
            const directory = new URL("../db/migrations/", import.meta.url);
            let historicalOrphanId = 0;
            let historicalReferencedId = 0;
            for (const name of (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort()) {
                if (name === "025_delete_account.sql") {
                    const rows = await pool.query<{ location_id: number; name: string }>(
                        `INSERT INTO location(name,address,latitude,longitude)
                         VALUES ('Old private place','Old private address',59.3,18.0),
                                ('Old shared place','Old shared address',59.4,18.1)
                         RETURNING location_id,name`
                    );
                    historicalOrphanId = rows.rows.find((row) => row.name === "Old private place")!.location_id;
                    historicalReferencedId = rows.rows.find((row) => row.name === "Old shared place")!.location_id;
                    await pool.query(
                        "INSERT INTO app_user(user_id,username,display_name) VALUES('migration-user','migration-user','Migration User')"
                    );
                    await pool.query(
                        `INSERT INTO board(owner_user_id,title,primary_location_id,primary_location_kind)
                         VALUES('migration-user','Migration Board',$1,'city')`,
                        [historicalReferencedId]
                    );
                }
                await pool.query(await readFile(new URL(name, directory), "utf8"));
            }
            assert.equal(
                (
                    await pool.query("SELECT count(*)::int AS count FROM location WHERE location_id=$1", [
                        historicalOrphanId
                    ])
                ).rows[0].count,
                0
            );
            assert.equal(
                (
                    await pool.query("SELECT count(*)::int AS count FROM location WHERE location_id=$1", [
                        historicalReferencedId
                    ])
                ).rows[0].count,
                1
            );
            await pool.query(
                "INSERT INTO app_user(user_id,username,display_name) VALUES ('owner','owner','Owner'),('other','other','Other'),('guest:one','guest','Guest')"
            );
            await pool.query("INSERT INTO guest_account(user_id) VALUES ('guest:one')");
            const owned = (
                await pool.query<{ board_id: number }>(
                    "INSERT INTO board(owner_user_id,title) VALUES('owner','Original') RETURNING board_id"
                )
            ).rows[0]!.board_id;
            const other = (
                await pool.query<{ board_id: number }>(
                    "INSERT INTO board(owner_user_id,title) VALUES('other','Other Board') RETURNING board_id"
                )
            ).rows[0]!.board_id;
            const remix = (
                await pool.query<{ board_id: number }>(
                    "INSERT INTO board(owner_user_id,title) VALUES('other','Independent remix') RETURNING board_id"
                )
            ).rows[0]!.board_id;
            async function location(name: string) {
                return (
                    await pool.query<{ location_id: number }>(
                        "INSERT INTO location(name,address,city,latitude,longitude) VALUES($1,$1,'Stockholm',59.3,18.0) RETURNING location_id",
                        [name]
                    )
                ).rows[0]!.location_id;
            }
            const privateDestination = await location("Private destination");
            const privateActivity = await location("Private activity address");
            const sharedLocation = await location("Shared location");
            const unrelatedLocation = await location("Unrelated location");
            await pool.query("UPDATE board SET primary_location_id=$1,primary_location_kind='city' WHERE board_id=$2", [
                privateDestination,
                owned
            ]);
            await pool.query("UPDATE board SET primary_location_id=$1,primary_location_kind='city' WHERE board_id=$2", [
                sharedLocation,
                other
            ]);
            await pool.query("INSERT INTO activity_type(type) VALUES('account-delete-test')");
            const ownedDay = (
                await pool.query<{ day_id: number }>(
                    "INSERT INTO board_day(board_id,day_number) VALUES($1,1) RETURNING day_id",
                    [owned]
                )
            ).rows[0]!.day_id;
            await pool.query(
                `INSERT INTO activity(board_id,day_id,day_number,position,title,type,location_id)
                 VALUES($1,$2,1,0,'Private activity','account-delete-test',$3),
                       ($1,$2,1,1,'Shared activity','account-delete-test',$4)`,
                [owned, ownedDay, privateActivity, sharedLocation]
            );
            async function image(key: string, uploader = "owner") {
                return (
                    await pool.query<{ uploaded_image_id: number }>(
                        `INSERT INTO uploaded_image(storage_key,uploaded_by_user_id,uploaded_at,captured_at,latitude,longitude)
                         VALUES($1,$2,NOW(),NOW(),59.3,18.0) RETURNING uploaded_image_id`,
                        [key, uploader]
                    )
                ).rows[0]!.uploaded_image_id;
            }
            const attached = await image("roamboard/account-attached");
            const avatar = await image("roamboard/account-avatar");
            const orphan = await image("roamboard/account-orphan");
            const shared = await image("roamboard/account-shared");
            const copied = await image("roamboard/other-remix-copy", "other");
            await pool.query("INSERT INTO board_image(board_id,uploaded_image_id,position) VALUES($1,$2,0)", [
                owned,
                attached
            ]);
            await pool.query("INSERT INTO board_image(board_id,uploaded_image_id,position) VALUES($1,$2,1)", [
                owned,
                shared
            ]);
            await pool.query("UPDATE board SET cover_image_id=$1 WHERE board_id=$2", [shared, other]);
            await pool.query("INSERT INTO board_image(board_id,uploaded_image_id,position) VALUES($1,$2,0)", [
                remix,
                copied
            ]);
            await pool.query("UPDATE app_user SET profile_picture_image_id=$1 WHERE user_id='owner'", [avatar]);
            await pool.query("INSERT INTO saved_boards(board_id,user_id) VALUES($1,'other'),($2,'owner')", [
                owned,
                other
            ]);
            await pool.query(
                "INSERT INTO friendship(status,requester_user_id,recipient_user_id) VALUES('accepted','owner','other')"
            );
            await pool.query("INSERT INTO board_member(board_id,user_id,role) VALUES($1,'owner','viewer')", [other]);
            await pool.query("INSERT INTO user_language(user_id,language_name) VALUES('owner','English')");
            await pool.query(
                "INSERT INTO saved_place(user_id,place_id,name,latitude,longitude,city,country) VALUES('owner','place','Place',59.3,18.0,'Stockholm','SWE')"
            );
            await pool.query("INSERT INTO google_place_reference(user_id,place_id) VALUES('owner','google-place')");
            const otherComment = (
                await pool.query<{ comment_id: number }>(
                    "INSERT INTO board_comment(board_id,author_user_id,body) VALUES($1,'other','On original') RETURNING comment_id",
                    [owned]
                )
            ).rows[0]!.comment_id;
            const ownerComment = (
                await pool.query<{ comment_id: number }>(
                    "INSERT INTO board_comment(board_id,author_user_id,body) VALUES($1,'owner','On other') RETURNING comment_id",
                    [other]
                )
            ).rows[0]!.comment_id;
            await pool.query(
                "INSERT INTO board_comment_notification(comment_id,recipient_user_id) VALUES($1,'other')",
                [ownerComment]
            );
            await pool.query(
                "INSERT INTO board_comment_mention(comment_id,user_id,handle) VALUES($1,'owner','owner')",
                [otherComment]
            );
            await pool.query(
                "INSERT INTO board_comment_subscription(board_id,user_id,enabled) VALUES($1,'owner',true)",
                [other]
            );
            const browserId = randomUUID();
            await pool.query("INSERT INTO board_browser(browser_id,user_id) VALUES($1,'owner')", [browserId]);
            await pool.query("INSERT INTO board_view(board_id,viewer_key,user_id) VALUES($1,'u:owner','owner')", [
                other
            ]);
            await pool.query(
                "INSERT INTO board_view_challenge(board_id,viewer_key,token) VALUES($1,'u:owner',$2),($1,$3,$4)",
                [other, randomUUID(), `g:${browserId}`, randomUUID()]
            );
            const stagedKey = "roamboard/account-staged";
            await pool.query(
                `INSERT INTO image_upload_intent(upload_id,user_id,storage_key,file_name,content_type,size_bytes,expires_at)
                 VALUES($1,'owner',$2,'private-name.jpg','image/jpeg',100,NOW()+INTERVAL '1 hour')`,
                [randomUUID(), stagedKey]
            );
            const token = "owner-session";
            const secondToken = "owner-second-session";
            for (const value of [token, secondToken]) {
                await pool.query(
                    "INSERT INTO auth_session(token_hash,user_id,expires_at) VALUES($1,'owner',NOW()+INTERVAL '7 days')",
                    [createHash("sha256").update(value).digest("hex")]
                );
            }
            const app = createApp();
            const cookie = `${sessionCookieName()}=${token}`;

            const guestCookie = `${sessionCookieName()}=guest-session`;
            await pool.query(
                "INSERT INTO auth_session(token_hash,user_id,expires_at) VALUES($1,'guest:one',NOW()+INTERVAL '7 days')",
                [createHash("sha256").update("guest-session").digest("hex")]
            );
            const guestResponse = await request(app)
                .delete("/api/v1/users/me")
                .set("Cookie", guestCookie)
                .set("Origin", origin);
            assert.equal(guestResponse.status, 403);
            assert.equal(guestResponse.body.error.code, "ACCOUNT_DELETION_UNAVAILABLE");

            await pool.query(
                `CREATE FUNCTION fail_account_delete() RETURNS TRIGGER LANGUAGE plpgsql AS $$
                 BEGIN RAISE EXCEPTION 'simulated failure'; END $$`
            );
            await pool.query(
                "CREATE TRIGGER fail_account_delete BEFORE DELETE ON app_user FOR EACH ROW EXECUTE FUNCTION fail_account_delete()"
            );
            const failed = await request(app).delete("/api/v1/users/me").set("Cookie", cookie).set("Origin", origin);
            assert.equal(failed.status, 500);
            assert.equal(
                (await pool.query("SELECT count(*)::int AS count FROM account_asset_cleanup")).rows[0].count,
                0
            );
            assert.equal(
                (await pool.query("SELECT count(*)::int AS count FROM board WHERE board_id=$1", [owned])).rows[0].count,
                1
            );
            assert.equal(
                (
                    await pool.query("SELECT count(*)::int AS count FROM location WHERE location_id=$1", [
                        privateActivity
                    ])
                ).rows[0].count,
                1
            );
            await pool.query("DROP TRIGGER fail_account_delete ON app_user");
            await pool.query("DROP FUNCTION fail_account_delete()");

            const deleted = await request(app).delete("/api/v1/users/me").set("Cookie", cookie).set("Origin", origin);
            assert.equal(deleted.status, 200);
            assert.deepEqual(deleted.body, { data: { deleted: true } });
            assert.equal(
                (await pool.query("SELECT count(*)::int AS count FROM app_user WHERE user_id='owner'")).rows[0].count,
                0
            );
            assert.equal(
                (await pool.query("SELECT count(*)::int AS count FROM auth_session WHERE user_id='owner'")).rows[0]
                    .count,
                0
            );
            assert.equal(
                (await pool.query("SELECT count(*)::int AS count FROM board WHERE board_id=$1", [owned])).rows[0].count,
                0
            );
            for (const locationId of [privateDestination, privateActivity]) {
                assert.equal(
                    (await pool.query("SELECT count(*)::int AS count FROM location WHERE location_id=$1", [locationId]))
                        .rows[0].count,
                    0,
                    `private location ${locationId}`
                );
            }
            for (const locationId of [sharedLocation, unrelatedLocation]) {
                assert.equal(
                    (await pool.query("SELECT count(*)::int AS count FROM location WHERE location_id=$1", [locationId]))
                        .rows[0].count,
                    1,
                    `surviving location ${locationId}`
                );
            }
            assert.equal(
                (await pool.query("SELECT count(*)::int AS count FROM board_comment WHERE author_user_id='owner'"))
                    .rows[0].count,
                0
            );
            for (const table of [
                "friendship",
                "saved_boards",
                "saved_place",
                "google_place_reference",
                "user_language",
                "board_member",
                "board_comment_notification",
                "board_comment_mention",
                "board_comment_subscription",
                "board_browser",
                "board_view",
                "board_view_challenge",
                "image_upload_intent"
            ]) {
                const column =
                    table === "friendship"
                        ? "requester_user_id"
                        : table === "board_comment_notification"
                          ? "recipient_user_id"
                          : table === "board_view_challenge"
                            ? "viewer_key"
                            : "user_id";
                const value = table === "board_view_challenge" ? "u:owner" : "owner";
                assert.equal(
                    (await pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE ${column}=$1`, [value]))
                        .rows[0].count,
                    0,
                    table
                );
            }
            assert.equal(
                (
                    await pool.query("SELECT count(*)::int AS count FROM board_view_challenge WHERE viewer_key=$1", [
                        `g:${browserId}`
                    ])
                ).rows[0].count,
                0
            );
            assert.equal(
                (await pool.query("SELECT count(*)::int AS count FROM board WHERE board_id=$1", [remix])).rows[0].count,
                1
            );
            assert.equal(
                (
                    await pool.query(
                        "SELECT count(*)::int AS count FROM uploaded_image WHERE uploaded_by_user_id='owner'"
                    )
                ).rows[0].count,
                0
            );
            const images = createImagesRepository();
            assert.equal(await images.findImage(attached), null);
            assert.equal(await images.findImage(avatar), null);
            assert.equal(await images.findImage(orphan), null);
            assert.equal((await images.findImage(shared))?.uploaderUserId, null);
            assert.equal((await images.findImage(shared))?.latitude, null);
            assert.equal((await images.findImage(copied))?.uploaderUserId, "other");
            assert.equal(
                (await request(app).get("/api/v1/auth/me").set("Cookie", `${sessionCookieName()}=${secondToken}`))
                    .status,
                401
            );
            await pool.query("INSERT INTO app_user(user_id,username,display_name) VALUES('owner','owner','New Owner')");

            const assets = new Set([
                stagedKey,
                "roamboard/account-attached",
                "roamboard/account-avatar",
                "roamboard/account-orphan",
                "roamboard/account-shared",
                "roamboard/other-remix-copy"
            ]);
            const unavailable = new Set(["roamboard/account-attached"]);
            const provider = {
                async destroy(key: string) {
                    if (unavailable.has(key)) throw new Error("provider unavailable");
                    assets.delete(key);
                },
                async openVariant() {
                    return { stream: Readable.from(Buffer.from("photo")), contentType: "image/jpeg" };
                }
            } as ImageProvider;
            const cleanup = createImageCleanup(images, provider);
            const first = await cleanup.cleanupUnused();
            assert.ok(first.failed >= 1);
            assert.ok(assets.has("roamboard/account-attached"));
            unavailable.clear();
            await cleanup.cleanupUnused();
            assert.ok(!assets.has("roamboard/account-attached"));
            assert.ok(assets.has(stagedKey), "staged upload keeps its authorization grace period");
            assert.ok(assets.has("roamboard/account-shared"), "legacy referenced photo remains");
            assert.ok(assets.has("roamboard/other-remix-copy"), "another owner's remix remains");
            const imageService = createImagesService(images, provider, createBoardsRepository());
            await assert.rejects(imageService.openImage(shared, "original", null), { statusCode: 404 });
        } finally {
            await closeDatabase();
            process.env.DATABASE_URL = previousUrl;
            await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
            await admin.end();
        }
    }
);
