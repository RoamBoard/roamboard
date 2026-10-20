import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Readable } from "node:stream";
import test from "node:test";
import { Client } from "pg";
import request from "supertest";
import { createApp } from "../src/app.js";
import { sessionCookieName } from "../src/shared/session-cookie.js";
import { closeDatabase, getPool } from "../src/db.js";
import { createBoardsRepository } from "../src/features/boards/boards.repository.js";
import { createBoardsService } from "../src/features/boards/boards.service.js";
import type { BoardWrite } from "../src/features/boards/boards.schemas.js";
import { createImageCleanup } from "../src/features/images/images.cleanup.js";
import { createImagesRepository } from "../src/features/images/images.repository.js";
import { createImagesService } from "../src/features/images/images.service.js";
import type { ImageProvider } from "../src/features/images/images.types.js";
import { createUsersRepository } from "../src/features/users/users.repository.js";
import { createUsersService } from "../src/features/users/users.service.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

test(
    "committed image removals clean storage and rows, preserve live references, and retry failures",
    {
        skip: databaseUrl ? undefined : "TEST_DATABASE_URL or DATABASE_URL is required"
    },
    async (context) => {
        context.mock.method(process.stderr, "write", () => true);
        const schema = `rb_image_deletion_${randomBytes(6).toString("hex")}`;
        const admin = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 });
        await admin.connect();
        const originalUrl = process.env.DATABASE_URL;
        try {
            await admin.query(`CREATE SCHEMA ${schema}`);
            const url = new URL(databaseUrl!);
            url.searchParams.set("options", `-csearch_path=${schema}`);
            process.env.DATABASE_URL = url.toString();
            const pool = getPool();
            const migrations = new URL("../db/migrations/", import.meta.url);
            for (const file of (await readdir(migrations)).filter((name) => name.endsWith(".sql")).sort()) {
                await pool.query(await readFile(new URL(file, migrations), "utf8"));
            }
            await pool.query(
                "INSERT INTO app_user(user_id,username,display_name) VALUES ('owner','owner','Owner'),('other','other','Other')"
            );
            const assets = new Set<string>();
            const unavailable = new Set<string>();
            const attempts: string[] = [];
            const provider = {
                async copy(sourceKey: string, targetKey: string) {
                    assert.ok(assets.has(sourceKey), "The source file must exist while preparing a remix");
                    assert.notEqual(targetKey, sourceKey);
                    assets.add(targetKey);
                    return {
                        storageKey: targetKey,
                        format: "jpg",
                        byteSize: 100,
                        createdAt: new Date(),
                        capturedAt: null,
                        latitude: null,
                        longitude: null
                    };
                },
                async openVariant(key: string) {
                    assert.ok(assets.has(key), "Remix delivery must read its surviving independent asset");
                    return { stream: Readable.from(Buffer.from("jpeg-data")), contentType: "image/jpeg" };
                },
                async destroy(key: string) {
                    attempts.push(key);
                    if (unavailable.has(key)) throw new Error("Provider unavailable");
                    assets.delete(key); // Missing provider files are an idempotent successful deletion.
                }
            } as ImageProvider;
            const images = createImagesRepository();
            const cleanup = createImageCleanup(images, provider);
            const boardRepository = createBoardsRepository();
            const boards = createBoardsService(boardRepository, undefined, cleanup.cleanupRequested);
            const users = createUsersService(
                createUsersRepository(),
                images,
                boardRepository,
                cleanup.cleanupRequested
            );
            const token = randomBytes(32).toString("hex");
            await pool.query(
                "INSERT INTO auth_session(token_hash,user_id,expires_at) VALUES ($1,'owner',NOW()+INTERVAL '1 hour')",
                [createHash("sha256").update(token).digest("hex")]
            );
            const app = createApp({ imageProvider: provider });
            const cookie = `${sessionCookieName()}=${token}`;
            const origin = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";
            async function upload(key: string) {
                const now = new Date();
                const intent = {
                    uploadId: randomUUID(),
                    userId: "owner",
                    storageKey: key,
                    fileName: "photo.jpg",
                    contentType: "image/jpeg",
                    sizeBytes: 100,
                    createdAt: now,
                    expiresAt: new Date(now.getTime() + 3600000),
                    imageId: null
                };
                await images.createIntent(intent);
                const imageId = await images.completeIntent(intent, {
                    storageKey: key,
                    format: "jpg",
                    byteSize: 100,
                    createdAt: now,
                    capturedAt: null,
                    latitude: null,
                    longitude: null
                });
                assets.add(key);
                return imageId;
            }
            async function assertGone(imageId: number, key: string) {
                assert.equal(await images.findImage(imageId), null);
                assert.equal(assets.has(key), false);
                assert.equal(
                    (await pool.query("SELECT 1 FROM image_upload_intent WHERE storage_key=$1", [key])).rowCount,
                    0
                );
            }
            const draft = (imageIds: number[]): BoardWrite => ({
                status: "draft",
                title: "Trip",
                description: null,
                visibility: "collaborators",
                imageIds,
                tagIds: [],
                days: []
            });

            // Unrelated queued images must not be processed by another Board/profile request.
            const unrelated = await upload("roamboard/unrelated-queued");
            await pool.query("UPDATE uploaded_image SET deletion_requested_at=NOW() WHERE uploaded_image_id=$1", [
                unrelated
            ]);

            // A different user's saved remix retains its cover and activity photos after source deletion.
            const sourceCover = await upload("roamboard/remix-source-cover");
            const sourceActivity = await upload("roamboard/remix-source-activity");
            const location = {
                name: "Stockholm",
                latitude: 59.33,
                longitude: 18.07,
                address: null,
                city: "Stockholm",
                country: "SWE",
                externalPlaceId: null
            };
            const source = await boards.create("owner", {
                ...draft([sourceCover, sourceActivity]),
                status: "published",
                visibility: "public",
                destination: { ...location, kind: "city", externalPlaceId: "geoapify:stockholm" },
                coverImageId: sourceCover,
                days: [
                    {
                        dayNumber: 1,
                        date: null,
                        activities: [
                            {
                                position: 0,
                                title: "Walk",
                                activityTime: null,
                                category: "other",
                                note: null,
                                source: "manual",
                                location,
                                locationConfirmed: true,
                                uploadedImageIds: [sourceActivity],
                                coverImageId: sourceActivity,
                                externalImage: null
                            }
                        ]
                    }
                ]
            });
            await createUsersRepository().saveBoard("other", source.boardId);
            const imageService = createImagesService(images, provider, boardRepository);
            const remixService = createBoardsService(
                boardRepository,
                imageService.copyForBoard,
                cleanup.cleanupRequested
            );
            const prepared = await remixService.prepareRemix("other", source.boardId);
            assert.equal(prepared.images.length, 2);
            assert.equal(prepared.coverImageId, prepared.images[0]!.imageId);
            assert.equal(prepared.days[0]?.activities[0]?.uploadedImageIds.length, 1);
            const remixed = await remixService.create("other", {
                ...draft(prepared.images.map((image) => image.imageId)),
                title: prepared.title,
                description: prepared.description,
                destination: prepared.destination,
                coverImageId: prepared.coverImageId,
                days: prepared.days
            });
            const copiedImages = await Promise.all(prepared.images.map((image) => images.findImage(image.imageId)));
            assert.ok(copiedImages.every((image) => image?.uploaderUserId === "other"));
            assert.ok(
                prepared.images.every((image) => image.imageId !== sourceCover && image.imageId !== sourceActivity)
            );
            await request(app)
                .delete(`/api/v1/boards/${source.boardId}`)
                .set("Cookie", cookie)
                .set("Origin", origin)
                .expect(204);
            await assertGone(sourceCover, "roamboard/remix-source-cover");
            await assertGone(sourceActivity, "roamboard/remix-source-activity");
            assert.ok(assets.has("roamboard/unrelated-queued"));
            assert.ok(await images.findImage(unrelated));
            const survivingRemix = await remixService.read(remixed.boardId, "other");
            assert.equal(survivingRemix.coverImageId, prepared.coverImageId);
            assert.equal(
                survivingRemix.days[0]?.activities[0]?.coverImageId,
                prepared.days[0]?.activities[0]?.coverImageId
            );
            assert.deepEqual(
                survivingRemix.days[0]?.activities[0]?.uploadedImageIds,
                prepared.days[0]?.activities[0]?.uploadedImageIds
            );
            for (const image of copiedImages) {
                assert.ok(image);
                assert.ok(await images.findImage(image.imageId));
                assert.ok(assets.has(image.storageKey));
                assert.equal(attempts.includes(image.storageKey), false);
                const delivery = await imageService.openImage(image.imageId, "display", "other");
                assert.equal(delivery.contentType, "image/jpeg");
                delivery.stream.destroy();
            }
            await remixService.delete(remixed.boardId, "other");
            for (const image of copiedImages) await assertGone(image!.imageId, image!.storageKey);

            // Older Boards that actually share one image row retain it until the final Board releases it.
            const sharedBoardPhoto = await upload("roamboard/shared-between-boards");
            const olderSource = await boards.create("owner", draft([sharedBoardPhoto]));
            const olderRemix = await boards.create("other", draft([]));
            await pool.query("UPDATE board SET cover_image_id=$1 WHERE board_id=$2", [
                sharedBoardPhoto,
                olderRemix.boardId
            ]);
            await boards.delete(olderSource.boardId, "owner");
            assert.ok(await images.findImage(sharedBoardPhoto));
            assert.ok(assets.has("roamboard/shared-between-boards"));
            const sharedDelivery = await imageService.openImage(sharedBoardPhoto, "display", "other");
            sharedDelivery.stream.destroy();
            await boards.delete(olderRemix.boardId, "other");
            await assertGone(sharedBoardPhoto, "roamboard/shared-between-boards");

            // Replacing/removing a profile image cleans the old upload and its completed upload intent immediately.
            const avatar = await upload("roamboard/avatar-old");
            const replacement = await upload("roamboard/avatar-new");
            await request(app)
                .put("/api/v1/users/me/profile-picture")
                .set("Cookie", cookie)
                .set("Origin", origin)
                .send({ imageId: avatar })
                .expect(200);
            await request(app)
                .put("/api/v1/users/me/profile-picture")
                .set("Cookie", cookie)
                .set("Origin", origin)
                .send({ imageId: replacement })
                .expect(200);
            await assertGone(avatar, "roamboard/avatar-old");
            assert.ok(assets.has("roamboard/unrelated-queued"));
            assert.equal((await images.findImage(replacement))?.profileOwnerUserId, "owner");
            await users.setPicture("owner", replacement);
            assert.equal(assets.has("roamboard/avatar-new"), true);
            await request(app)
                .delete("/api/v1/users/me/profile-picture")
                .set("Cookie", cookie)
                .set("Origin", origin)
                .expect(200);
            await assertGone(replacement, "roamboard/avatar-new");

            // A profile removal cannot delete a photo still used by a Board; deleting that Board releases it.
            const shared = await upload("roamboard/shared");
            const sharedBoard = await boards.create("owner", draft([shared]));
            await users.setPicture("owner", shared);
            await users.setPicture("owner", null);
            assert.equal(assets.has("roamboard/shared"), true);
            await boards.delete(sharedBoard.boardId, "owner");
            await assertGone(shared, "roamboard/shared");

            // Saving a replacement removes discarded photos, while delete/reinsert of retained links is harmless.
            const removed = await upload("roamboard/removed");
            const retained = await upload("roamboard/retained");
            const board = await boards.create("owner", draft([removed, retained]));
            await assert.rejects(boards.delete(board.boardId, "other"), { code: "FORBIDDEN" });
            await assert.rejects(boards.replace("owner", board.boardId, 99, draft([retained])), {
                code: "STALE_BOARD_REVISION"
            });
            assert.equal(assets.has("roamboard/removed"), true);
            const saved = await boards.replace("owner", board.boardId, board.revision, draft([retained]));
            await assertGone(removed, "roamboard/removed");
            assert.equal(assets.has("roamboard/retained"), true);

            // Failed provider deletion retains the row and queue; a later process can retry after Board deletion.
            unavailable.add("roamboard/retained");
            await boards.delete(saved.boardId, "owner");
            assert.ok(await images.findImage(retained));
            assert.equal(
                (
                    await pool.query(
                        "SELECT deletion_requested_at IS NOT NULL AS pending FROM uploaded_image WHERE uploaded_image_id=$1",
                        [retained]
                    )
                ).rows[0]?.pending,
                true
            );
            unavailable.clear();
            await createImageCleanup(createImagesRepository(), provider).cleanupRequested([retained]);
            await assertGone(retained, "roamboard/retained");

            // If storage succeeds but the DB delete fails, retry tolerates the now-missing provider asset.
            const dbFailure = await upload("roamboard/db-failure");
            await users.setPicture("owner", dbFailure);
            await pool.query(`CREATE FUNCTION reject_image_delete() RETURNS TRIGGER LANGUAGE plpgsql AS $$
                BEGIN RAISE EXCEPTION 'simulated database deletion failure'; END; $$;
                CREATE TRIGGER reject_image_delete BEFORE DELETE ON uploaded_image
                FOR EACH ROW EXECUTE FUNCTION reject_image_delete();`);
            await users.setPicture("owner", null);
            assert.equal(assets.has("roamboard/db-failure"), false);
            assert.ok(await images.findImage(dbFailure));
            assert.equal(
                (await pool.query("SELECT 1 FROM image_upload_intent WHERE uploaded_image_id=$1", [dbFailure]))
                    .rowCount,
                1
            );
            await pool.query("DROP TRIGGER reject_image_delete ON uploaded_image; DROP FUNCTION reject_image_delete()");
            await cleanup.cleanupRequested([dbFailure]);
            await assertGone(dbFailure, "roamboard/db-failure");

            // Concurrent sweeps use the row lock rather than deleting the same provider asset twice.
            const concurrent = await upload("roamboard/concurrent");
            const profileRepository = createUsersRepository();
            await profileRepository.setPicture("owner", concurrent);
            await profileRepository.setPicture("owner", null);
            await Promise.all([
                cleanup.cleanupRequested([concurrent]),
                createImageCleanup(images, provider).cleanupRequested([concurrent])
            ]);
            await assertGone(concurrent, "roamboard/concurrent");
            assert.equal(attempts.filter((key) => key === "roamboard/concurrent").length, 1);

            // Cover-only and activity-only references from older data are included in cascading Board removal.
            const cover = await upload("roamboard/cover-only");
            const activityCover = await upload("roamboard/activity-cover-only");
            const activityPhoto = await upload("roamboard/activity-only");
            const legacy = await boards.create("owner", draft([]));
            await pool.query("UPDATE board SET cover_image_id=$1 WHERE board_id=$2", [cover, legacy.boardId]);
            const day = await pool.query<{ day_id: number }>(
                "INSERT INTO board_day(board_id,day_number) VALUES ($1,1) RETURNING day_id",
                [legacy.boardId]
            );
            const activity = await pool.query<{ activity_id: number }>(
                `INSERT INTO activity(board_id,title,type,position,day_number,source,location_confirmed,cover_image_id,day_id)
            VALUES ($1,'Walk','other',0,1,'manual',false,$2,$3) RETURNING activity_id`,
                [legacy.boardId, activityCover, day.rows[0]!.day_id]
            );
            await pool.query("INSERT INTO activity_image(uploaded_image_id,activity_id,position) VALUES ($1,$2,0)", [
                activityPhoto,
                activity.rows[0]!.activity_id
            ]);
            await request(app).delete(`/api/v1/boards/${legacy.boardId}`).set("Cookie", cookie).expect(403);
            await request(app)
                .delete(`/api/v1/boards/${legacy.boardId}`)
                .set("Cookie", cookie)
                .set("Origin", origin)
                .expect(204);
            await assertGone(cover, "roamboard/cover-only");
            await assertGone(activityCover, "roamboard/activity-cover-only");
            await assertGone(activityPhoto, "roamboard/activity-only");

            // Rollbacks do not enqueue deletions. Fresh staging uploads and editorial images remain untouched.
            const staged = await upload("roamboard/staged");
            await users.setPicture("owner", staged);
            const client = await pool.connect();
            try {
                await client.query("BEGIN");
                await client.query("UPDATE app_user SET profile_picture_image_id=NULL WHERE user_id='owner'");
                await client.query("ROLLBACK");
            } finally {
                client.release();
            }
            await cleanup.cleanupRequested([staged]);
            assert.equal(assets.has("roamboard/staged"), true);
            const fresh = await upload("roamboard/fresh");
            const editorial = await upload("roamboard/editorial/never-delete");
            await pool.query(
                "UPDATE uploaded_image SET orphaned_at=NOW()-INTERVAL '25 hours' WHERE uploaded_image_id=$1",
                [editorial]
            );
            await cleanup.cleanupUnused();
            await assertGone(unrelated, "roamboard/unrelated-queued");
            assert.ok(await images.findImage(fresh));
            assert.ok(await images.findImage(editorial));
            assert.equal(attempts.includes("roamboard/editorial/never-delete"), false);
            await pool.query(
                "UPDATE uploaded_image SET orphaned_at=NOW()-INTERVAL '25 hours' WHERE uploaded_image_id=$1",
                [fresh]
            );
            await cleanup.cleanupUnused();
            await assertGone(fresh, "roamboard/fresh");
        } finally {
            await closeDatabase();
            process.env.DATABASE_URL = originalUrl;
            await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
            await admin.end();
        }
    }
);
