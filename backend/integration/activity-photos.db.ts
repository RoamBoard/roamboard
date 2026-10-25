import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { Client } from "pg";
import { closeDatabase, getPool } from "../src/db.js";
import { createBoardsRepository } from "../src/features/boards/boards.repository.js";
import { createBoardsService } from "../src/features/boards/boards.service.js";
import { replaceBoardSchema } from "../src/features/boards/boards.schemas.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const crop = { x: 0.1, y: 0.2, width: 0.7, height: 0.6, outputWidth: 800, outputHeight: 600 };
const context = { kind: "illustrative", scope: "region", locationLabel: "Dalarna, Sweden" };
function external(providerImageId: string) {
    return {
        source: "unsplash" as const,
        providerImageId,
        url: `https://images.unsplash.com/${providerImageId}?ixid=original`,
        thumbnailUrl: `https://images.unsplash.com/${providerImageId}?ixid=original&w=400`,
        alt: providerImageId,
        photographer: "Photographer",
        photographerUrl: "https://unsplash.com/@photographer",
        sourceUrl: `https://unsplash.com/photos/${providerImageId}`,
        width: 1600,
        height: 2400,
        context: null,
        presentation: null
    };
}

test(
    "migration preserves legacy photos and mixed photo order, covers, crops and compatibility survive save/read/remix",
    {
        skip: databaseUrl ? undefined : "TEST_DATABASE_URL or DATABASE_URL is required"
    },
    async () => {
        const schema = `rb_activity_photos_${randomBytes(6).toString("hex")}`;
        const admin = new Client({ connectionString: databaseUrl });
        await admin.connect();
        const originalUrl = process.env.DATABASE_URL;
        try {
            await admin.query(`CREATE SCHEMA ${schema}`);
            const url = new URL(databaseUrl!);
            url.searchParams.set("options", `-csearch_path=${schema}`);
            process.env.DATABASE_URL = url.toString();
            const pool = getPool();
            const directory = new URL("../db/migrations/", import.meta.url);
            for (const name of (await readdir(directory))
                .filter((name) => /^\d+.*\.sql$/.test(name) && name < "024_")
                .sort())
                await pool.query(await readFile(new URL(name, directory), "utf8"));
            await pool.query(
                "INSERT INTO app_user (user_id,username,display_name) VALUES ('media-owner','media-owner','Owner'),('media-remixer','media-remixer','Remixer')"
            );
            const uploads = await pool.query<{ uploaded_image_id: number }>(
                "INSERT INTO uploaded_image(storage_key,uploaded_by_user_id,uploaded_at,presentation_edit,presentation_revision) VALUES ('media/one','media-owner',NOW(),$1,3),('media/two','media-owner',NOW(),NULL,0),('media/legacy-cover-only','media-owner',NOW(),NULL,0) RETURNING uploaded_image_id",
                [crop]
            );
            const ids = uploads.rows.slice(0, 2).map((row) => row.uploaded_image_id);
            const legacyCoverId = uploads.rows[2]!.uploaded_image_id;
            const boardId = (
                await pool.query<{ board_id: number }>(
                    "INSERT INTO board(owner_user_id,title,status,visibility) VALUES ('media-owner','Legacy media','draft','public') RETURNING board_id"
                )
            ).rows[0]!.board_id;
            const dayId = (
                await pool.query<{ day_id: number }>(
                    "INSERT INTO board_day(board_id,day_number,color) VALUES ($1,1,'#b87568') RETURNING day_id",
                    [boardId]
                )
            ).rows[0]!.day_id;
            const activityId = (
                await pool.query<{ activity_id: number }>(
                    "INSERT INTO activity(board_id,day_id,day_number,position,title,type,external_image_provider,external_image_id,external_image_url,external_image_photographer,external_image_photographer_url,external_image_source_url,external_image_context) VALUES ($1,$2,1,0,'Lake','museum','unsplash','old-photo','https://images.unsplash.com/old-photo?ixid=old','Original Photographer','https://unsplash.com/@original','https://unsplash.com/photos/old-photo',$3) RETURNING activity_id",
                    [boardId, dayId, context]
                )
            ).rows[0]!.activity_id;
            await pool.query(
                "INSERT INTO board_image(board_id,uploaded_image_id,position) VALUES ($1,$2,0),($1,$3,1)",
                [boardId, ...ids]
            );
            await pool.query(
                "INSERT INTO activity_image(activity_id,uploaded_image_id,position) VALUES ($1,$2,0),($1,$3,1)",
                [activityId, ...ids]
            );
            await pool.query("INSERT INTO board_image(board_id,uploaded_image_id,position) VALUES ($1,$2,2)", [
                boardId,
                legacyCoverId
            ]);
            await pool.query(
                "INSERT INTO activity(board_id,day_id,day_number,position,title,type,cover_image_id) VALUES ($1,$2,1,1,'Historical cover-only activity','museum',$3)",
                [boardId, dayId, legacyCoverId]
            );
            await pool.query(await readFile(new URL("024_activity_photos.sql", directory), "utf8"));
            const repository = createBoardsRepository();
            const service = createBoardsService(repository, async (_user, _board, id) => id + 1000);
            const migrated = await service.read(boardId, "media-owner");
            const migratedActivity = migrated.days[0]!.activities[0]!;
            const historicalCover = migrated.days[0]!.activities[1]!;
            assert.deepEqual(
                historicalCover.photos,
                [{ source: "upload", imageId: legacyCoverId }],
                "Historical cover-only uploads become canonical attached photos"
            );
            assert.deepEqual(
                historicalCover.coverPhoto,
                { source: "upload", imageId: legacyCoverId },
                "Migration retains the historical saved upload cover"
            );
            assert.deepEqual(
                migratedActivity.photos?.map((photo) =>
                    photo.source === "upload" ? photo.imageId : photo.providerImageId
                ),
                [...ids, "old-photo"]
            );
            assert.deepEqual(migratedActivity.coverPhoto, { source: "unsplash", providerImageId: "old-photo" });
            const oldPhoto = migratedActivity.photos?.find((photo) => photo.source === "unsplash");
            assert.ok(oldPhoto?.source === "unsplash");
            assert.equal(oldPhoto.photographer, "Original Photographer");
            assert.deepEqual(oldPhoto.context, context);
            assert.equal(migrated.days[0]?.color, "#b87568");
            const originalUpload = (
                await pool.query(
                    "SELECT presentation_edit,presentation_revision FROM uploaded_image WHERE uploaded_image_id=$1",
                    [ids[0]]
                )
            ).rows[0];
            assert.deepEqual(originalUpload.presentation_edit, crop);
            assert.equal(originalUpload.presentation_revision, 3);
            const second = { ...external("second-photo"), presentation: crop };
            const photos = [
                external("first-photo"),
                { source: "upload", imageId: ids[1] },
                second,
                { source: "upload", imageId: ids[0] }
            ];
            const coverPhoto = { source: "unsplash", providerImageId: "second-photo" };
            const base = {
                title: "Mixed trip",
                description: null,
                status: "draft",
                visibility: "public",
                tagIds: [],
                imageIds: ids
            };
            const activity = {
                activityId,
                position: 0,
                title: "Lake",
                activityTime: null,
                category: "museum",
                note: null,
                source: "manual",
                location: null,
                locationConfirmed: false
            };
            async function save(revision: number, media: Record<string, unknown>) {
                const write = replaceBoardSchema.parse({
                    ...base,
                    revision,
                    days: [{ dayId, dayNumber: 1, date: null, activities: [{ ...activity, ...media }] }]
                });
                return service.replace("media-owner", boardId, revision, write);
            }
            const saved = await save(migrated.revision, { photos, coverPhoto });
            const reopened = await service.read(boardId, "media-owner");
            assert.deepEqual(reopened.days[0]!.activities[0]!.photos, photos);
            assert.deepEqual(reopened.days[0]!.activities[0]!.coverPhoto, coverPhoto);
            assert.deepEqual(reopened.days[0]!.activities[0]!.uploadedImageIds, [ids[1], ids[0]]);
            assert.equal(reopened.days[0]!.activities[0]!.externalImage?.providerImageId, "first-photo");
            const omitted = await save(saved.revision, {});
            assert.deepEqual(
                omitted.days[0]!.activities[0]!.photos,
                photos,
                "An older client omitting media preserves every mixed attachment"
            );
            assert.deepEqual(omitted.days[0]!.activities[0]!.coverPhoto, coverPhoto);
            const projection = omitted.days[0]!.activities[0]!;
            const legacy = await save(omitted.revision, {
                uploadedImageIds: projection.uploadedImageIds,
                externalImage: projection.externalImage,
                coverImageId: null
            });
            assert.deepEqual(
                legacy.days[0]!.activities[0]!.photos,
                photos,
                "Unchanged legacy projections must not erase additional external photos or crops"
            );
            assert.deepEqual(
                legacy.days[0]!.activities[0]!.coverPhoto,
                coverPhoto,
                "Null legacy upload cover must not clear a chosen external cover"
            );
            await pool.query("UPDATE board SET status='published' WHERE board_id=$1", [boardId]);
            await pool.query("INSERT INTO saved_boards(user_id,board_id) VALUES ('media-remixer',$1)", [boardId]);
            const remixed = await service.prepareRemix("media-remixer", boardId);
            assert.deepEqual(
                remixed.days[0]!.activities[0]!.photos,
                photos.map((photo) =>
                    photo.source === "upload" ? { ...photo, imageId: photo.imageId! + 1000 } : photo
                )
            );
            assert.deepEqual(remixed.days[0]!.activities[0]!.coverPhoto, coverPhoto);
            await pool.query("UPDATE board SET status='draft' WHERE board_id=$1", [boardId]);
            const clearedFirst = await save(legacy.revision, {
                uploadedImageIds: projection.uploadedImageIds,
                externalImage: null,
                coverImageId: null
            });
            assert.deepEqual(
                clearedFirst.days[0]!.activities[0]!.photos?.filter((photo) => photo.source === "unsplash"),
                [second],
                "Legacy external null clears only its first projection"
            );
            await assert.rejects(
                pool.query(
                    "UPDATE activity_photo SET external_photo=jsonb_set(external_photo,'{presentation}',$1::jsonb) WHERE activity_id=$2 AND source='unsplash'",
                    [JSON.stringify({ ...crop, x: 0.9 }), activityId]
                ),
                { code: "23514" }
            );
            const detached = await save(clearedFirst.revision, { photos: [], coverPhoto: null });
            assert.deepEqual(detached.days[0]!.activities[0]!.photos, []);
            assert.deepEqual(detached.imageIds, ids, "Detaching every activity photo retains both Board uploads");
            assert.equal(
                (await pool.query("SELECT count(*)::int AS total FROM uploaded_image")).rows[0].total,
                3,
                "Removing a reference must not delete any original upload binary"
            );
        } finally {
            await closeDatabase();
            if (originalUrl === undefined) delete process.env.DATABASE_URL;
            else process.env.DATABASE_URL = originalUrl;
            await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
            await admin.end();
        }
    }
);
