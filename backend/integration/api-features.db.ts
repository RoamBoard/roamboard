import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Client } from "pg";
import { closeDatabase, getPool } from "../src/db.js";
import { createBoardsRepository } from "../src/features/boards/boards.repository.js";
import { createBoardsService } from "../src/features/boards/boards.service.js";
import { createImagesRepository } from "../src/features/images/images.repository.js";
import { createUsersRepository } from "../src/features/users/users.repository.js";
import { createUsersService } from "../src/features/users/users.service.js";
import { createPostgresGooglePlaceReferenceRepository } from "../src/features/providers/provider.repository.js";
import { createPostgresQuotaRepository } from "../src/features/quotas/quota.postgres-repository.js";
import { createSearchRepository } from "../src/features/search/search.repository.js";
import type { BoardWrite } from "../src/features/boards/boards.schemas.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

test(
    "new API persistence, access rules and concurrent quota reservations in PostgreSQL",
    {
        skip: databaseUrl ? undefined : "TEST_DATABASE_URL or DATABASE_URL is required"
    },
    async () => {
        const schema = `rb_api_test_${randomBytes(6).toString("hex")}`;
        const admin = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 });
        await admin.connect();
        const originalUrl = process.env.DATABASE_URL;
        try {
            await admin.query(`CREATE SCHEMA ${schema}`);
            const url = new URL(databaseUrl!);
            url.searchParams.set("options", `-csearch_path=${schema}`);
            process.env.DATABASE_URL = url.toString();
            const pool = getPool();
            for (const name of [
                "001_initial.sql",
                "002_auth_session.sql",
                "003_board_creator.sql",
                "004_api_features.sql"
            ]) {
                await pool.query(await readFile(new URL(`../db/migrations/${name}`, import.meta.url), "utf8"));
            }
            await pool.query(`INSERT INTO app_user (user_id, username, display_name)
                         VALUES ('owner','owner','Owner'), ('friend','friend','Friend'), ('editor','editor','Editor'), ('stranger','stranger','Stranger');
                         INSERT INTO friendship (status, requester_user_id, recipient_user_id) VALUES ('accepted','owner','friend');`);
            const boards = createBoardsRepository();
            const service = createBoardsService(boards);
            const input: BoardWrite = {
                status: "published",
                title: "Tokyo",
                description: null,
                visibility: "public",
                isCompleted: true,
                tagIds: [],
                imageIds: [],
                coverImageId: null,
                days: [
                    {
                        dayNumber: 1,
                        date: null,
                        activities: [
                            {
                                position: 0,
                                title: "Tokyo city",
                                activityTime: null,
                                category: "city",
                                note: null,
                                source: "geoapify",
                                locationConfirmed: true,
                                uploadedImageIds: [],
                                coverImageId: null,
                                externalImage: null,
                                location: {
                                    name: "Tokyo",
                                    city: "Tokyo",
                                    country: "Japan",
                                    latitude: 35.68,
                                    longitude: 139.76,
                                    address: null,
                                    externalPlaceId: null
                                }
                            }
                        ]
                    }
                ]
            };
            const publicBoard = await service.create("owner", input);
            const friendsBoard = await service.create("owner", { ...input, visibility: "friends" });
            const memberBoard = await service.create("owner", { ...input, visibility: "collaborators" });
            const draft = await service.create("owner", { ...input, status: "draft" });
            await pool.query(
                "INSERT INTO board_member (board_id, user_id, role) VALUES ($1,'editor','editor'), ($2,'editor','editor')",
                [memberBoard.boardId, draft.boardId]
            );
            assert.deepEqual(
                (await service.listAccessible("stranger", 1, 20)).items.map((board) => board.boardId),
                [publicBoard.boardId]
            );
            assert.deepEqual(
                new Set((await service.listAccessible("friend", 1, 20)).items.map((board) => board.boardId)),
                new Set([publicBoard.boardId, friendsBoard.boardId])
            );
            assert.deepEqual(
                new Set((await service.listAccessible("editor", 1, 20)).items.map((board) => board.boardId)),
                new Set([publicBoard.boardId, memberBoard.boardId])
            );
            assert.equal((await service.listAccessible("owner", 1, 2)).hasMore, true);
            const profiles = createUsersRepository();
            const users = createUsersService(profiles, createImagesRepository(), boards);
            await users.update("owner", {
                displayName: "Updated owner",
                description: "Traveller",
                location: "Stockholm",
                interests: ["Food"]
            });
            assert.equal((await users.read("owner")).displayName, "Updated owner");
            assert.deepEqual((await users.read("owner")).interests, ["Food"]);
            await assert.rejects(() =>
                users.update("owner", { displayName: "Bad", description: "", location: null, interests: ["Unknown"] })
            );
            assert.equal((await users.read("owner")).displayName, "Updated owner");
            const image = await pool.query<{ uploaded_image_id: number }>(
                "INSERT INTO uploaded_image (storage_key, uploaded_by_user_id, uploaded_at) VALUES ('roamboard/profile','owner',NOW()) RETURNING uploaded_image_id"
            );
            const imageId = image.rows[0]!.uploaded_image_id;
            await assert.rejects(() => users.setPicture("friend", imageId));
            await users.setPicture("owner", imageId);
            assert.equal((await users.read("owner")).profilePicture?.imageId, imageId);
            await pool.query(
                "UPDATE uploaded_image SET orphaned_at=NOW()-INTERVAL '25 hours' WHERE uploaded_image_id=$1",
                [imageId]
            );
            assert.equal(
                (await createImagesRepository().listCleanupCandidates(new Date(), 100)).some(
                    (candidate) => candidate.imageId === imageId
                ),
                false
            );
            await users.setPicture("owner", null);
            assert.equal((await users.read("owner")).profilePicture, null);
            assert.equal((await users.stats("owner")).countriesVisited, 1);
            assert.equal((await users.mapDestinations("owner")).length, 3);
            assert.equal((await users.mapDestinations("owner"))[0]?.countryCode, "JPN");
            const { isCompleted: _completed, ...withoutCompletion } = input;
            assert.equal(_completed, true);
            const changed = await service.replace("owner", publicBoard.boardId, publicBoard.revision, {
                ...withoutCompletion,
                title: "New title"
            });
            assert.equal(changed.isCompleted, true);
            const source = createSearchRepository();
            assert.deepEqual(await source.listPublicIds(), [String(publicBoard.boardId)]);
            assert.deepEqual(await source.listPublic([]), []);
            assert.deepEqual(await source.listPublic(["0"]), []);
            assert.deepEqual(
                (await source.listPublic()).map((document) => document.title),
                ["New title"]
            );
            assert.deepEqual((await source.listPublic([String(publicBoard.boardId)]))[0]?.categories, ["city"]);
            const references = createPostgresGooglePlaceReferenceRepository();
            await references.save("owner", "place-1");
            assert.deepEqual(await references.list("friend"), []);
            assert.equal(await references.delete("friend", "place-1"), false);
            assert.equal((await references.list("owner")).length, 1);
            const quota = createPostgresQuotaRepository();
            const windows = [
                {
                    name: "hour:UTC",
                    period: "hour" as const,
                    limit: 3,
                    timeZone: "UTC",
                    startsAt: new Date("2026-10-14T12:00:00Z"),
                    endsAt: new Date("2026-10-14T13:00:00Z")
                }
            ];
            const attempts = await Promise.all(
                Array.from({ length: 10 }, () => quota.reserve("concurrent", 1, windows))
            );
            assert.equal(attempts.filter((attempt) => attempt.allowed).length, 3);
            // Rollover reuses the row, including when requests race at the boundary.
            const nextHour = {
                ...windows[0]!,
                startsAt: new Date("2026-10-14T13:00:00Z"),
                endsAt: new Date("2026-10-14T14:00:00Z")
            };
            const rollover = await Promise.all(
                Array.from({ length: 10 }, () => quota.reserve("concurrent", 1, [nextHour]))
            );
            assert.equal(rollover.filter((attempt) => attempt.allowed).length, 3);
            assert.equal((await quota.reserve("concurrent", 1, windows)).allowed, false);
            const counters = await pool.query(
                "SELECT window_start, used FROM api_quota_usage WHERE policy_id='concurrent' AND window_name='hour:UTC'"
            );
            assert.equal(counters.rows.length, 1);
            assert.equal(counters.rows[0].window_start.toISOString(), nextHour.startsAt.toISOString());
            assert.equal(counters.rows[0].used, "3");

            // Resetting one window must roll back if a longer window is exhausted.
            const day = {
                ...windows[0]!,
                name: "day:UTC",
                period: "day" as const,
                limit: 1,
                startsAt: new Date("2026-10-14T00:00:00Z"),
                endsAt: new Date("2026-10-15T00:00:00Z")
            };
            assert.equal((await quota.reserve("rollover-rollback", 1, [windows[0]!, day])).allowed, true);
            assert.equal((await quota.reserve("rollover-rollback", 1, [nextHour, day])).allowed, false);
            const unchanged = await pool.query(
                "SELECT window_start, used FROM api_quota_usage WHERE policy_id='rollover-rollback' AND window_name='hour:UTC'"
            );
            assert.equal(unchanged.rows[0].window_start.toISOString(), windows[0]!.startsAt.toISOString());
            assert.equal(unchanged.rows[0].used, "1");

            // Many short windows still occupy just one row per window type.
            for (const [period, duration] of [
                ["second", 1000],
                ["minute", 60000]
            ] as const) {
                for (let index = 0; index < 100; index++) {
                    const start = Date.parse("2026-10-14T12:00:00Z") + index * duration;
                    assert.equal(
                        (
                            await quota.reserve("compact", 1, [
                                {
                                    ...windows[0]!,
                                    name: `${period}:UTC`,
                                    period,
                                    startsAt: new Date(start),
                                    endsAt: new Date(start + duration)
                                }
                            ])
                        ).allowed,
                        true
                    );
                }
            }
            assert.equal((await pool.query("SELECT * FROM api_quota_usage WHERE policy_id='compact'")).rows.length, 3);

            // A clock boundary cannot grant a fresh rolling allowance.
            const rollingWindow = { ...windows[0]!, name: "hour:rolling:UTC", rolling: true };
            assert.equal((await quota.reserve("rolling", 3, [rollingWindow])).allowed, true);
            const rollingNext = { ...nextHour, name: rollingWindow.name, rolling: true };
            assert.equal((await quota.reserve("rolling", 1, [rollingNext])).allowed, false);
            const afterQuietPeriod = {
                ...rollingNext,
                startsAt: new Date("2026-10-14T14:00:00Z"),
                endsAt: new Date("2026-10-14T15:00:00Z")
            };
            const rollingAttempts = await Promise.all(
                Array.from({ length: 10 }, () => quota.reserve("rolling", 1, [afterQuietPeriod]))
            );
            assert.equal(rollingAttempts.filter((attempt) => attempt.allowed).length, 3);
            assert.equal((await pool.query("SELECT * FROM api_quota_usage WHERE policy_id='rolling'")).rows.length, 2);

            // Cooldowns are shared across repository instances and cannot be shortened
            // by a delayed response; once expired, no manual reset is necessary.
            const until = new Date(Date.now() + 60000);
            await quota.block!("cooldown", until);
            const anotherProcess = createPostgresQuotaRepository();
            await anotherProcess.block!("cooldown", new Date(Date.now() + 1000));
            const blocked = await anotherProcess.reserve("cooldown", 1, windows);
            assert.equal(blocked.allowed, false);
            assert.equal(blocked.retryAt?.toISOString(), until.toISOString());
            await pool.query(
                "UPDATE api_quota_usage SET window_end=now()-interval '1 second' WHERE policy_id='cooldown' AND window_name='provider:cooldown'"
            );
            assert.equal((await anotherProcess.reserve("cooldown", 1, windows)).allowed, true);
            const result = await quota.reserve("transaction", 1, [
                windows[0]!,
                { ...windows[0]!, name: "disabled", limit: 0 }
            ]);
            assert.equal(result.allowed, false);
            assert.equal(
                (await pool.query("SELECT used FROM api_quota_usage WHERE policy_id='transaction'")).rows.length,
                0
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
