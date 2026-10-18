import "dotenv/config";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import test from "node:test";

import { Client } from "pg";

import { closeDatabase, getPool } from "../src/db.js";
import { createBoardsRepository } from "../src/features/boards/boards.repository.js";
import { createBoardsService } from "../src/features/boards/boards.service.js";
import type { BoardWrite } from "../src/features/boards/boards.schemas.js";
import { createImagesRepository } from "../src/features/images/images.repository.js";
import { createImagesService } from "../src/features/images/images.service.js";
import type { ImageProvider } from "../src/features/images/images.types.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

test(
    "Board migration and transactional creator flow in PostgreSQL",
    {
        skip: databaseUrl ? undefined : "TEST_DATABASE_URL or DATABASE_URL is required"
    },
    async () => {
        // Fixture writes use a temporary schema so this test cannot overwrite application Boards.
        const schema = `rb_test_${randomBytes(6).toString("hex")}`;
        const admin = new Client({ connectionString: databaseUrl });
        await admin.connect();
        const originalUrl = process.env.DATABASE_URL;
        try {
            await admin.query(`CREATE SCHEMA ${schema}`);
            const url = new URL(databaseUrl!);
            url.searchParams.set("options", `-csearch_path=${schema}`);
            process.env.DATABASE_URL = url.toString();
            const migrationClient = new Client({ connectionString: url.toString() });
            await migrationClient.connect();
            try {
                for (const name of [
                    "001_initial.sql",
                    "002_auth_session.sql",
                    "003_board_creator.sql",
                    "004_api_features.sql",
                    "006_profile.sql",
                    "007_profile_tag_catalog.sql",
                    "008_board_destination.sql",
                    "009_image_presentation.sql",
                    "010_guest_accounts.sql"
                ]) {
                    const sql = await readFile(new URL(`../db/migrations/${name}`, import.meta.url), "utf8");
                    await migrationClient.query(sql);
                    if (name === "002_auth_session.sql") {
                        await migrationClient.query(
                            `INSERT INTO app_user (user_id, username, display_name)
                         VALUES ('legacy-sub','legacy','Legacy');
                         INSERT INTO uploaded_image (storage_key, uploaded_by_user_id, uploaded_at)
                         VALUES ('legacy/cover', 'legacy-sub', NOW()),
                                ('legacy/act-img', 'legacy-sub', NOW()),
                                ('legacy/act-cover', 'legacy-sub', NOW());
                         INSERT INTO activity_type (type) VALUES ('museum');
                         INSERT INTO board (owner_user_id, title, cover_image_id)
                         SELECT 'legacy-sub', 'Old Board', uploaded_image_id
                         FROM uploaded_image WHERE storage_key = 'legacy/cover';
                         INSERT INTO activity (day_number, board_id, position, title, type, cover_image_id)
                         SELECT 2, b.board_id, 0, 'Old Activity', 'museum', u.uploaded_image_id
                         FROM board b
                         CROSS JOIN (SELECT uploaded_image_id FROM uploaded_image WHERE storage_key = 'legacy/act-cover') u
                         WHERE b.title = 'Old Board';
                         INSERT INTO activity_image (uploaded_image_id, activity_id, position)
                         SELECT u.uploaded_image_id, a.activity_id, 0
                         FROM activity a
                         CROSS JOIN (SELECT uploaded_image_id FROM uploaded_image WHERE storage_key = 'legacy/act-img') u
                         WHERE a.title = 'Old Activity';`
                        );
                    }
                    if (name === "003_board_creator.sql") {
                        const backfill = await migrationClient.query<{
                            day_id: number;
                            day_number: number;
                            status: string;
                        }>(
                            `SELECT a.day_id, d.day_number, b.status FROM activity a
                         JOIN board_day d ON d.day_id=a.day_id
                         JOIN board b ON b.board_id=a.board_id WHERE b.title='Old Board'`
                        );
                        assert.equal(backfill.rows[0]?.day_number, 2);
                        assert.equal(backfill.rows[0]?.status, "published");
                        const backfillDays = await migrationClient.query<{ day_number: number }>(
                            `SELECT d.day_number FROM board_day d
                         JOIN board b ON b.board_id = d.board_id
                         WHERE b.title = 'Old Board'
                         ORDER BY d.day_number`
                        );
                        assert.deepEqual(
                            backfillDays.rows.map((r) => r.day_number),
                            [1, 2]
                        );
                        const backfillImages = await migrationClient.query<{
                            uploaded_image_id: number;
                            position: number;
                            storage_key: string;
                            orphaned_at: Date | null;
                        }>(
                            `SELECT bi.uploaded_image_id, bi.position, u.storage_key, u.orphaned_at
                         FROM board_image bi
                         JOIN board b ON b.board_id = bi.board_id
                         JOIN uploaded_image u ON u.uploaded_image_id = bi.uploaded_image_id
                         WHERE b.title = 'Old Board'
                         ORDER BY bi.position`
                        );
                        assert.equal(backfillImages.rows.length, 3);
                        assert.equal(backfillImages.rows[0]?.storage_key, "legacy/cover");
                        assert.equal(backfillImages.rows[0]?.position, 0);
                        assert.equal(backfillImages.rows[0]?.orphaned_at, null);
                        assert.equal(backfillImages.rows[1]?.storage_key, "legacy/act-img");
                        assert.equal(backfillImages.rows[1]?.position, 1);
                        assert.equal(backfillImages.rows[1]?.orphaned_at, null);
                        assert.equal(backfillImages.rows[2]?.storage_key, "legacy/act-cover");
                        assert.equal(backfillImages.rows[2]?.position, 2);
                        assert.equal(backfillImages.rows[2]?.orphaned_at, null);
                        await migrationClient.query(
                            `DELETE FROM board WHERE title='Old Board';
                         DELETE FROM uploaded_image WHERE storage_key LIKE 'legacy/%';
                         DELETE FROM app_user WHERE user_id='legacy-sub';`
                        );
                    }
                }
            } finally {
                await migrationClient.end();
            }

            const pool = getPool();
            await pool.query(
                `INSERT INTO app_user (user_id, username, display_name) VALUES
             ('owner-sub', 'owner', 'Owner'), ('other-sub', 'other', 'Other')`
            );
            const images = await pool.query<{ uploaded_image_id: number }>(
                `INSERT INTO uploaded_image (storage_key, uploaded_by_user_id, uploaded_at)
             VALUES ('roamboard/test-1','owner-sub',NOW()),('roamboard/test-2','owner-sub',NOW())
             RETURNING uploaded_image_id`
            );
            const imageA = images.rows[0]!.uploaded_image_id;
            const imageB = images.rows[1]!.uploaded_image_id;
            const tags = await createBoardsRepository().listTags();
            const catalog = JSON.parse(
                await readFile(new URL("../../shared/roamboard-tags.json", import.meta.url), "utf8")
            ) as { tags: Array<{ name: string }> };
            const availableNames = new Set(tags.map((tag) => tag.name));
            assert.ok(catalog.tags.every((tag) => availableNames.has(tag.name)));
            const foodId = tags.find((tag) => tag.name === "Food")!.tagId;
            const repository = createBoardsRepository();
            const service = createBoardsService(repository);
            const destroyedAssets: string[] = [];
            const provider: ImageProvider = {
                authorizeUpload(storageKey) {
                    return {
                        uploadUrl: "https://api.cloudinary.test/image/upload",
                        method: "POST",
                        headers: {},
                        formFields: { public_id: storageKey }
                    };
                },
                async inspect(storageKey) {
                    return {
                        storageKey,
                        format: "jpg",
                        byteSize: 4000,
                        createdAt: new Date(),
                        capturedAt: new Date("2026-05-01T10:00:00Z"),
                        latitude: 35.68,
                        longitude: 139.76
                    };
                },
                async openVariant() {
                    return { stream: Readable.from(Buffer.from("jpeg")), contentType: "image/jpeg" };
                },
                async destroy(storageKey) {
                    destroyedAssets.push(storageKey);
                }
            };
            const imageService = createImagesService(createImagesRepository(), provider, repository);
            const upload = await imageService.createIntent("owner-sub", {
                fileName: "tokyo.heic",
                contentType: "image/heic",
                sizeBytes: 4000
            });
            await assert.rejects(imageService.complete("other-sub", upload.uploadId), { code: "NOT_FOUND" });
            const completed = await imageService.complete("owner-sub", upload.uploadId);
            assert.equal(completed.imageId > 0, true);
            assert.equal(completed.latitude, 35.68);
            const crop = { x: 0.1, y: 0.2, width: 0.7, height: 0.6, outputWidth: 800, outputHeight: 600 };
            assert.deepEqual(await imageService.readPresentation("owner-sub", completed.imageId), {
                edit: null,
                revision: 0
            });
            assert.deepEqual(await imageService.savePresentation("owner-sub", completed.imageId, 0, crop), {
                edit: crop,
                revision: 1
            });
            assert.deepEqual(await imageService.readPresentation("owner-sub", completed.imageId), {
                edit: crop,
                revision: 1
            });
            assert.equal((await createImagesRepository().findImage(completed.imageId))?.latitude, 35.68);
            await assert.rejects(imageService.savePresentation("owner-sub", completed.imageId, 0, null), {
                code: "STALE_IMAGE_REVISION"
            });
            await imageService.savePresentation("owner-sub", completed.imageId, 1, null);
            assert.equal((await imageService.complete("owner-sub", upload.uploadId)).imageId, completed.imageId);
            await assert.rejects(imageService.openImage(completed.imageId, "thumbnail", null), { code: "NOT_FOUND" });
            assert.equal(
                (await imageService.openImage(completed.imageId, "thumbnail", "owner-sub")).contentType,
                "image/jpeg"
            );

            const empty: BoardWrite = {
                status: "draft",
                title: "",
                description: null,
                visibility: "collaborators",
                tagIds: [],
                imageIds: [],
                days: []
            };
            const destination: NonNullable<BoardWrite["destination"]> = {
                name: "Bali",
                kind: "region",
                latitude: -8.409518,
                longitude: 115.188919,
                address: "Bali, Indonesia",
                city: null,
                country: "IDN",
                externalPlaceId: "geoapify:bali"
            };
            const destinationBoard = await service.create("owner-sub", { ...empty, destination });
            assert.deepEqual((await service.read(destinationBoard.boardId, "owner-sub")).destination, destination);
            const legacyWrite = await service.replace("owner-sub", destinationBoard.boardId, 1, empty);
            assert.deepEqual(legacyWrite.destination, destination, "Older clients omitting destination preserve it");
            const cityDestination = {
                ...destination,
                name: "Stockholm",
                kind: "city" as const,
                latitude: 59.3293,
                longitude: 18.0686,
                address: "Stockholm, Sweden",
                city: "Stockholm",
                country: "SWE",
                externalPlaceId: "geoapify:stockholm"
            };
            const changedDestination = await service.replace("owner-sub", destinationBoard.boardId, 2, {
                ...empty,
                destination: cityDestination
            });
            assert.deepEqual(changedDestination.destination, cityDestination);
            const clearedDestination = await service.replace("owner-sub", destinationBoard.boardId, 3, {
                ...empty,
                destination: null
            });
            assert.equal(clearedDestination.destination, null);
            await service.delete(destinationBoard.boardId, "owner-sub");
            const created = await service.create("owner-sub", empty);
            assert.equal(created.revision, 1);
            assert.equal(created.title, "");
            assert.deepEqual(
                (await service.listDrafts("owner-sub", 1, 20)).items.map((item) => item.boardId),
                [created.boardId]
            );
            await assert.rejects(service.read(created.boardId, null), { code: "NOT_FOUND" });

            const draft: BoardWrite = {
                ...empty,
                title: "Tokyo",
                tagIds: [foodId],
                imageIds: [imageA, imageB],
                coverImageId: imageB,
                days: [
                    {
                        dayNumber: 1,
                        date: "2026-05-01",
                        activities: [
                            {
                                position: 0,
                                title: "Museum",
                                activityTime: "10:30",
                                category: "museum",
                                note: null,
                                source: "photo",
                                location: {
                                    name: "Example Museum",
                                    latitude: 35.681236,
                                    longitude: 139.767125,
                                    address: null,
                                    city: "Tokyo",
                                    country: "Japan",
                                    externalPlaceId: null
                                },
                                locationConfirmed: false,
                                uploadedImageIds: [imageA, imageB],
                                coverImageId: imageB,
                                externalImage: null
                            }
                        ]
                    },
                    { dayNumber: 2, date: null, activities: [] }
                ]
            };
            const saved = await service.replace("owner-sub", created.boardId, 1, draft);
            assert.equal(saved.revision, 2);
            assert.equal(saved.days.length, 2);
            assert.equal(saved.days[1]?.activities.length, 0);
            assert.deepEqual(saved.imageIds, [imageA, imageB]);
            assert.equal(saved.coverImageId, imageB);
            assert.deepEqual(saved.days[0]?.activities[0]?.uploadedImageIds, [imageA, imageB]);
            assert.equal(saved.days[0]?.activities[0]?.coverImageId, imageB);
            const dayId = saved.days[0]!.dayId;
            const activityId = saved.days[0]!.activities[0]!.activityId;
            await assert.rejects(service.replace("owner-sub", created.boardId, 1, draft), {
                code: "STALE_BOARD_REVISION"
            });
            await assert.rejects(
                service.replace("owner-sub", created.boardId, 2, {
                    ...draft,
                    days: [
                        {
                            ...draft.days[0]!,
                            dayId: saved.days[0]!.dayId,
                            activities: [{ ...draft.days[0]!.activities[0]!, activityId, coverImageId: 9999 }]
                        }
                    ]
                }),
                { code: "INVALID_REQUEST" }
            );
            await assert.rejects(service.replace("owner-sub", created.boardId, 2, { ...draft, status: "published" }), {
                code: "PUBLISH_REQUIREMENTS_NOT_MET"
            });
            assert.equal((await service.read(created.boardId, "owner-sub")).revision, 2);

            const publish: BoardWrite = {
                destination: {
                    name: "Tokyo",
                    kind: "city" as const,
                    latitude: 35.68,
                    longitude: 139.76,
                    address: "Tokyo, Japan",
                    city: "Tokyo",
                    country: "JPN",
                    externalPlaceId: "geoapify:tokyo"
                },
                ...draft,
                status: "published",
                days: draft.days.map((day, index) => ({
                    ...day,
                    dayId: saved.days[index]!.dayId,
                    activities: day.activities.map((activity, position) => ({
                        ...activity,
                        activityId: saved.days[index]!.activities[position]!.activityId,
                        locationConfirmed: true,
                        coverImageId: null,
                        externalImage: {
                            provider: "unsplash",
                            providerImageId: "photo-1",
                            url: "https://images.unsplash.com/photo-1",
                            photographer: "Example",
                            photographerUrl: null,
                            sourceUrl: null
                        }
                    }))
                }))
            };
            const published = await service.replace("owner-sub", created.boardId, 2, publish);
            assert.equal(published.revision, 3);
            assert.equal(published.days[0]?.dayId, dayId);
            assert.equal(published.days[0]?.activities[0]?.activityId, activityId);
            assert.equal(published.days[0]?.activities[0]?.coverImageId, null);
            assert.equal(published.days[0]?.activities[0]?.externalImage?.photographer, "Example");
            assert.equal(published.status, "published");
            assert.equal((await service.listDrafts("owner-sub", 1, 20)).items.length, 0);
            assert.deepEqual(
                (await service.listPublished("owner-sub", 1, 20)).items.map((item) => item.boardId),
                [created.boardId]
            );
            assert.equal((await service.listPublished("other-sub", 1, 20)).items.length, 0);
            await assert.rejects(service.read(created.boardId, "other-sub"), { code: "NOT_FOUND" });

            await pool.query("INSERT INTO board_member (board_id, user_id, role) VALUES ($1,'other-sub','viewer')", [
                created.boardId
            ]);
            const memberView = await service.read(created.boardId, "other-sub");
            assert.equal(memberView.permissions.canEditContent, false);
            await pool.query("UPDATE board_member SET role='editor' WHERE board_id=$1", [created.boardId]);
            assert.equal((await service.read(created.boardId, "other-sub")).permissions.canEditContent, true);
            await assert.rejects(
                service.replace("other-sub", created.boardId, 3, {
                    ...publish,
                    visibility: "public"
                }),
                { code: "FORBIDDEN" }
            );
            await assert.rejects(
                service.replace("other-sub", created.boardId, 3, {
                    ...publish,
                    status: "draft"
                }),
                { code: "INVALID_REQUEST" }
            );
            const edited = await service.replace("other-sub", created.boardId, 3, {
                ...publish,
                title: "Edited Tokyo",
                days: [
                    {
                        ...publish.days[0]!,
                        activities: [
                            {
                                ...publish.days[0]!.activities[0]!,
                                note: "Edited by collaborator"
                            }
                        ]
                    },
                    publish.days[1]!
                ]
            });
            assert.equal(edited.revision, 4);
            assert.equal(edited.days[0]?.activities[0]?.note, "Edited by collaborator");
            assert.deepEqual(edited.imageIds, [imageA, imageB]);
            assert.equal(edited.coverImageId, imageB);
            await assert.rejects(service.replace("owner-sub", created.boardId, 3, publish), {
                code: "STALE_BOARD_REVISION"
            });
            const ownerEdit = await service.replace("owner-sub", created.boardId, 4, {
                ...publish,
                visibility: "public",
                title: "Owner update"
            });
            assert.equal(ownerEdit.visibility, "public");
            assert.equal(ownerEdit.revision, 5);
            await pool.query("UPDATE board SET visibility='public' WHERE board_id=$1", [created.boardId]);
            assert.equal((await service.read(created.boardId, null)).boardId, created.boardId);
            assert.equal((await imageService.openImage(imageA, "thumbnail", null)).contentType, "image/jpeg");

            const alienImage = await pool.query<{ uploaded_image_id: number }>(
                `INSERT INTO uploaded_image (storage_key, uploaded_by_user_id, uploaded_at)
             VALUES ('roamboard/alien','other-sub',NOW()) RETURNING uploaded_image_id`
            );
            await assert.rejects(
                service.create("owner-sub", {
                    ...empty,
                    imageIds: [alienImage.rows[0]!.uploaded_image_id]
                }),
                { code: "INVALID_REQUEST" }
            );
            const count = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM board");
            assert.equal(count.rows[0]?.count, "1");

            await pool.query(
                "UPDATE uploaded_image SET orphaned_at = NOW() - INTERVAL '25 hours' WHERE uploaded_image_id = ANY($1::int[])",
                [[imageA, imageB]]
            );
            assert.equal((await imageService.cleanupUnused()).removed, 0);
            await service.delete(created.boardId, "owner-sub");
            assert.equal(await repository.getBoard(created.boardId), null);
            const children = await pool.query<{ count: string }>(
                "SELECT COUNT(*)::text AS count FROM activity WHERE board_id=$1",
                [created.boardId]
            );
            assert.equal(children.rows[0]?.count, "0");
            assert.equal((await imageService.cleanupUnused()).removed, 0);
            await pool.query(
                "UPDATE uploaded_image SET orphaned_at = NOW() - INTERVAL '25 hours' WHERE uploaded_image_id = ANY($1::int[])",
                [[imageA, imageB]]
            );
            assert.equal((await imageService.cleanupUnused()).removed, 2);
            assert.deepEqual(destroyedAssets.sort(), ["roamboard/test-1", "roamboard/test-2"].sort());
            assert.equal(await createImagesRepository().findImage(imageA), null);
        } finally {
            await closeDatabase();
            process.env.DATABASE_URL = originalUrl;
            await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
            await admin.end();
        }
    }
);
