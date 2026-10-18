import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import test from "node:test";
import { Client } from "pg";
import request from "supertest";
import { createApp } from "../src/app.js";
import { closeDatabase, getPool } from "../src/db.js";
import { createBoardsRepository } from "../src/features/boards/boards.repository.js";
import { createBoardsService } from "../src/features/boards/boards.service.js";
import { createAuthRepository } from "../src/features/auth/auth.repository.js";
import type { BoardWrite } from "../src/features/boards/boards.schemas.js";
import type { ImageProvider } from "../src/features/images/images.types.js";
import { sessionCookieName } from "../src/shared/session-cookie.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

test(
    "published viewer author details and profile photos respect real database access",
    { skip: databaseUrl ? undefined : "TEST_DATABASE_URL or DATABASE_URL is required" },
    async (t) => {
        // Test real SQL and API permissions in an isolated schema, separate from application users and Boards.
        const schema = `rb_viewer_test_${randomBytes(6).toString("hex")}`;
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
                "004_api_features.sql",
                "006_profile.sql",
                "007_profile_tag_catalog.sql",
                "008_board_destination.sql",
                "009_image_presentation.sql",
                "010_guest_accounts.sql"
            ]) {
                await pool.query(await readFile(new URL(`../db/migrations/${name}`, import.meta.url), "utf8"));
            }
            await pool.query(
                `INSERT INTO app_user (user_id, username, display_name, biography)
                 VALUES ('private-google-sub', 'actual_username', 'Different display name', 'I photograph old railway stations.'),
                 ('friend', 'friend', 'Friend', NULL), ('member', 'member', 'Member', NULL), ('stranger', 'stranger', 'Stranger', NULL);
                 INSERT INTO friendship (status, requester_user_id, recipient_user_id)
                 VALUES ('accepted', 'private-google-sub', 'friend')`
            );
            const auth = createAuthRepository();
            const cookies = new Map<string, string>();
            for (const userId of ["private-google-sub", "friend", "member", "stranger"]) {
                const token = randomBytes(24).toString("hex");
                await auth.createSession(
                    createHash("sha256").update(token).digest("hex"),
                    userId,
                    new Date(Date.now() + 60_000)
                );
                cookies.set(userId, `${sessionCookieName()}=${token}`);
            }
            const opened: string[] = [];
            const provider: ImageProvider = {
                authorizeUpload() {
                    throw new Error("No upload expected");
                },
                async inspect() {
                    throw new Error("No provider inspection expected");
                },
                async openVariant(storageKey) {
                    opened.push(storageKey);
                    return { stream: Readable.from(Buffer.from("test-photo")), contentType: "image/jpeg" };
                },
                async destroy() {
                    throw new Error("No image deletion expected");
                }
            };
            const app = createApp({ imageProvider: provider });
            const boards = createBoardsService(createBoardsRepository());
            const input: BoardWrite = {
                destination: {
                    name: "Stockholm",
                    kind: "city",
                    latitude: 59.33,
                    longitude: 18.058,
                    address: "Stockholm, Sweden",
                    city: "Stockholm",
                    country: "SWE",
                    externalPlaceId: "geoapify:stockholm"
                },
                status: "published",
                title: "A persisted Board",
                description: "An existing database Board",
                visibility: "public",
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
                                title: "Station walk",
                                activityTime: null,
                                category: "city",
                                note: null,
                                source: "manual",
                                uploadedImageIds: [],
                                coverImageId: null,
                                externalImage: null,
                                locationConfirmed: true,
                                location: {
                                    name: "Stockholm Central",
                                    latitude: 59.33,
                                    longitude: 18.058,
                                    city: "Stockholm",
                                    country: "Sweden",
                                    address: null,
                                    externalPlaceId: null
                                }
                            }
                        ]
                    }
                ]
            };
            const created = await boards.create("private-google-sub", input);
            await t.test(
                "public document uses current username and bio and excludes private account identity",
                async () => {
                    const response = await request(app).get(`/api/v1/boards/${created.boardId}`).expect(200);
                    assert.deepEqual(response.body.data.author, {
                        username: "actual_username",
                        bio: "I photograph old railway stations.",
                        photo: null
                    });
                    assert.doesNotMatch(
                        JSON.stringify(response.body.data.author),
                        /private-google-sub|Different display name/
                    );
                    await pool.query(
                        "UPDATE app_user SET username='changed_username', biography='Changed bio' WHERE user_id='private-google-sub'"
                    );
                    const changed = await request(app).get(`/api/v1/boards/${created.boardId}`).expect(200);
                    assert.deepEqual(changed.body.data.author, {
                        username: "changed_username",
                        bio: "Changed bio",
                        photo: null
                    });
                }
            );
            await t.test(
                "pre-existing published rows acquire live author details without a content resave",
                async () => {
                    const existing = await pool.query<{ board_id: number }>(
                        "INSERT INTO board (owner_user_id, title, visibility) VALUES ('private-google-sub', 'Older database Board', 'public') RETURNING board_id"
                    );
                    const response = await request(app).get(`/api/v1/boards/${existing.rows[0]!.board_id}`).expect(200);
                    assert.equal(response.body.data.status, "published");
                    assert.equal(response.body.data.title, "Older database Board");
                    assert.deepEqual(response.body.data.author, {
                        username: "changed_username",
                        bio: "Changed bio",
                        photo: null
                    });
                }
            );
            const images = await pool.query<{ uploaded_image_id: number }>(
                `INSERT INTO uploaded_image (storage_key, uploaded_by_user_id, uploaded_at)
                 VALUES ('roamboard/current-profile','private-google-sub',NOW()),
                 ('roamboard/unrelated-owner-photo','private-google-sub',NOW()),
                 ('roamboard/other-profile','stranger',NOW()) RETURNING uploaded_image_id`
            );
            const photoId = images.rows[0]!.uploaded_image_id;
            const unrelatedId = images.rows[1]!.uploaded_image_id;
            const strangerPhotoId = images.rows[2]!.uploaded_image_id;
            await pool.query("UPDATE app_user SET profile_picture_image_id=$1 WHERE user_id='private-google-sub'", [
                photoId
            ]);
            await pool.query("UPDATE app_user SET profile_picture_image_id=$1 WHERE user_id='stranger'", [
                strangerPhotoId
            ]);
            const friendsBoard = await boards.create("private-google-sub", { ...input, visibility: "friends" });
            const memberBoard = await boards.create("private-google-sub", { ...input, visibility: "collaborators" });
            const draft = await boards.create("private-google-sub", { ...input, status: "draft" });
            await pool.query(
                "INSERT INTO board_member (board_id, user_id, role) VALUES ($1,'member','editor'),($2,'member','editor')",
                [memberBoard.boardId, draft.boardId]
            );
            const contentPath = (imageId: number, boardId: number) =>
                `/api/v1/images/${imageId}/content?variant=display&boardId=${boardId}`;

            await t.test("public Board exposes only the current owner's photo through its scoped URL", async () => {
                const response = await request(app).get(`/api/v1/boards/${created.boardId}`).expect(200);
                assert.deepEqual(response.body.data.author.photo, {
                    imageId: photoId,
                    url: contentPath(photoId, created.boardId)
                });
                const image = await request(app).get(response.body.data.author.photo.url).expect(200);
                assert.match(image.headers["content-type"], /image\/jpeg/);
                assert.equal(image.headers["cache-control"], "private, no-store");
                assert.equal(opened.at(-1), "roamboard/current-profile");
                await request(app).get(`/api/v1/images/${photoId}/content?variant=display`).expect(404);
                const beforeRejected = opened.length;
                await request(app).get(contentPath(unrelatedId, created.boardId)).expect(404);
                await request(app).get(contentPath(strangerPhotoId, created.boardId)).expect(404);
                await request(app).get(contentPath(photoId, 999999)).expect(404);
                await request(app)
                    .get(contentPath(unrelatedId, created.boardId))
                    .set("Cookie", cookies.get("private-google-sub")!)
                    .expect(404);
                assert.equal(opened.length, beforeRejected);
            });

            await t.test(
                "friends and collaborator documents and author photos share the Board's permissions",
                async () => {
                    for (const [boardId, allowedUser, rejectedUser] of [
                        [friendsBoard.boardId, "friend", "member"],
                        [memberBoard.boardId, "member", "friend"]
                    ] as const) {
                        await request(app).get(`/api/v1/boards/${boardId}`).expect(404);
                        await request(app).get(contentPath(photoId, boardId)).expect(404);
                        await request(app)
                            .get(`/api/v1/boards/${boardId}`)
                            .set("Cookie", cookies.get(rejectedUser)!)
                            .expect(404);
                        await request(app)
                            .get(contentPath(photoId, boardId))
                            .set("Cookie", cookies.get(rejectedUser)!)
                            .expect(404);
                        const allowed = await request(app)
                            .get(`/api/v1/boards/${boardId}`)
                            .set("Cookie", cookies.get(allowedUser)!)
                            .expect(200);
                        assert.equal(allowed.body.data.author.username, "changed_username");
                        await request(app)
                            .get(allowed.body.data.author.photo.url)
                            .set("Cookie", cookies.get(allowedUser)!)
                            .expect(200);
                    }
                }
            );

            await t.test("drafts and their author photos remain owner-only even for a Board editor", async () => {
                for (const userId of [null, "friend", "member", "stranger"]) {
                    const documentRequest = request(app).get(`/api/v1/boards/${draft.boardId}`);
                    const imageRequest = request(app).get(contentPath(photoId, draft.boardId));
                    if (userId) {
                        documentRequest.set("Cookie", cookies.get(userId)!);
                        imageRequest.set("Cookie", cookies.get(userId)!);
                    }
                    await documentRequest.expect(404);
                    await imageRequest.expect(404);
                }
                const owner = await request(app)
                    .get(`/api/v1/boards/${draft.boardId}`)
                    .set("Cookie", cookies.get("private-google-sub")!)
                    .expect(200);
                assert.equal(owner.body.data.status, "draft");
                await request(app)
                    .get(contentPath(photoId, draft.boardId))
                    .set("Cookie", cookies.get("private-google-sub")!)
                    .expect(200);
            });

            await t.test("newly published drafts obtain the same live author details", async () => {
                const published = await boards.replace("private-google-sub", draft.boardId, draft.revision, input);
                const response = await request(app).get(`/api/v1/boards/${published.boardId}`).expect(200);
                assert.equal(response.body.data.status, "published");
                assert.equal(response.body.data.author.username, "changed_username");
                await request(app).get(response.body.data.author.photo.url).expect(200);
            });

            await t.test(
                "a previously issued photo URL stops working when the owner's current photo changes",
                async () => {
                    await pool.query(
                        "UPDATE app_user SET profile_picture_image_id=$1 WHERE user_id='private-google-sub'",
                        [unrelatedId]
                    );
                    await request(app).get(contentPath(photoId, created.boardId)).expect(404);
                    const updated = await request(app).get(`/api/v1/boards/${created.boardId}`).expect(200);
                    assert.deepEqual(updated.body.data.author.photo, {
                        imageId: unrelatedId,
                        url: contentPath(unrelatedId, created.boardId)
                    });
                    await request(app).get(updated.body.data.author.photo.url).expect(200);
                    await pool.query(
                        "UPDATE app_user SET profile_picture_image_id=NULL, biography=NULL WHERE user_id='private-google-sub'"
                    );
                    const removed = await request(app).get(`/api/v1/boards/${created.boardId}`).expect(200);
                    assert.deepEqual(removed.body.data.author, { username: "changed_username", bio: "", photo: null });
                    await request(app).get(contentPath(unrelatedId, created.boardId)).expect(404);
                }
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
