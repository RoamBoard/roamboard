import "dotenv/config";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { Client } from "pg";
import request from "supertest";

import { createApp } from "../src/app.js";
import { closeDatabase, getPool } from "../src/db.js";
import { createCommentsRepository } from "../src/features/board-comments/board-comments.repository.js";
import { createCommentsService } from "../src/features/board-comments/board-comments.service.js";
import { createBoardsRepository } from "../src/features/boards/boards.repository.js";
import { createBoardsService } from "../src/features/boards/boards.service.js";
import type { BoardWrite } from "../src/features/boards/boards.schemas.js";
import type { BoardDocument, FillerImage, FillerPool, FillerProvider } from "../src/features/boards/boards.types.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

function input(): BoardWrite {
    return {
        title: "Kyoto story",
        description: "Saved notes",
        status: "published",
        visibility: "public",
        fillerImagesEnabled: true,
        destination: {
            kind: "city",
            name: "Kyoto",
            country: "JPN",
            externalPlaceId: "geoapify:kyoto",
            latitude: 35.01,
            longitude: 135.76,
            address: null,
            city: "Kyoto"
        },
        tagIds: [],
        imageIds: [],
        days: [
            {
                dayNumber: 1,
                date: null,
                activities: [
                    {
                        position: 0,
                        title: "Morning walk",
                        activityTime: "09:00",
                        category: "museum",
                        note: "A saved note",
                        source: "manual",
                        locationConfirmed: true,
                        location: {
                            name: "Museum",
                            latitude: 35.01,
                            longitude: 135.76,
                            address: null,
                            city: "Kyoto",
                            country: "JPN",
                            externalPlaceId: "geoapify:museum"
                        },
                        uploadedImageIds: [],
                        externalImage: null
                    }
                ]
            },
            { dayNumber: 2, date: null, activities: [] }
        ]
    };
}

function write(document: BoardDocument): BoardWrite {
    const days = structuredClone(document.days);
    for (const day of days)
        for (const activity of day.activities) {
            delete activity.photos;
            delete activity.coverPhoto;
        }
    return {
        title: document.title,
        description: document.description,
        destination: document.destination,
        status: document.status,
        visibility: document.visibility,
        fillerImagesEnabled: document.fillerImagesEnabled,
        isCompleted: document.isCompleted,
        coverImageId: document.coverImageId,
        tagIds: document.tagIds,
        imageIds: document.imageIds,
        days
    };
}

function photo(id: string): Omit<FillerImage, "position"> {
    return {
        provider: "unsplash",
        providerImageId: id,
        url: `https://images.unsplash.com/${id}?w=1600`,
        thumbnailUrl: `https://images.unsplash.com/${id}?w=320`,
        largeUrl: `https://images.unsplash.com/${id}?w=4096`,
        width: 6000,
        height: 4000,
        alt: "Destination illustration",
        photographer: "Photographer",
        photographerUrl: "https://unsplash.com/@photographer",
        sourceUrl: `https://unsplash.com/photos/${id}`
    };
}

function provider(prefix = "kyoto") {
    const calls = { searches: [] as string[], selections: [] as string[] };
    const state = { prefix, fail: false };
    const value: FillerProvider = {
        async search(query) {
            calls.searches.push(query);
            if (state.fail) throw new Error("Optional provider unavailable");
            return [0, 1, 2].map((index) => ({ id: `${state.prefix}-${index}` }));
        },
        async select(id) {
            calls.selections.push(id);
            return photo(id);
        }
    };
    return { calls, state, value };
}

function signal() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

test(
    "Board story migrations and persistence remain atomic in an isolated PostgreSQL schema",
    {
        skip: databaseUrl ? undefined : "TEST_DATABASE_URL or DATABASE_URL is required",
        timeout: 120_000
    },
    async (context) => {
        const schema = `rb_story_test_${randomBytes(6).toString("hex")}`;
        const originalUrl = process.env.DATABASE_URL;
        const admin = new Client({
            connectionString: databaseUrl,
            connectionTimeoutMillis: 3000,
            statement_timeout: 10000
        });
        await admin.connect();
        let created = false;
        try {
            await admin.query(`CREATE SCHEMA "${schema}"`);
            created = true;
            const isolatedUrl = new URL(databaseUrl!);
            isolatedUrl.searchParams.set(
                "options",
                `-csearch_path=${schema} -cstatement_timeout=10000 -clock_timeout=5000`
            );
            process.env.DATABASE_URL = isolatedUrl.toString();
            const migrationClient = new Client({
                connectionString: isolatedUrl.toString(),
                connectionTimeoutMillis: 3000
            });
            await migrationClient.connect();
            try {
                const migrationDirectory = new URL("../db/migrations/", import.meta.url);
                const migrations = (await readdir(migrationDirectory))
                    .filter((name) => /^\d+_.+\.sql$/.test(name))
                    .sort();
                assert.ok(migrations.includes("021_board_story.sql"));
                for (const name of migrations)
                    await migrationClient.query(await readFile(new URL(name, migrationDirectory), "utf8"));
            } finally {
                await migrationClient.end();
            }
            const pool = getPool();
            assert.equal(
                (await pool.query<{ current_schema: string }>("SELECT current_schema()")).rows[0]?.current_schema,
                schema
            );
            await pool.query(`INSERT INTO app_user (user_id, username, display_name) VALUES
            ('story-owner', 'story_owner', 'Owner'), ('story-author', 'story_author', 'Author'),
            ('story-editor', 'story_editor', 'Editor')`);
            const repository = createBoardsRepository();

            await context.test(
                "activity illustration context survives saves, omission and remixes and clears explicitly",
                async () => {
                    const service = createBoardsService(repository);
                    const body = input();
                    body.fillerImagesEnabled = false;
                    const activity = body.days[0]!.activities[0]!;
                    const illustration = {
                        kind: "illustrative" as const,
                        scope: "region" as const,
                        locationLabel: "Kyoto, Japan"
                    };
                    activity.externalImage = {
                        provider: "unsplash",
                        providerImageId: "regional-photo",
                        url: "https://images.unsplash.com/regional-photo",
                        photographer: "Photographer",
                        photographerUrl: "https://unsplash.com/@photographer",
                        sourceUrl: "https://unsplash.com/photos/regional-photo",
                        context: illustration
                    };
                    const board = await service.create("story-owner", body);
                    assert.deepEqual(board.days[0]!.activities[0]!.externalImage?.context, illustration);
                    const legacy = write(board);
                    delete legacy.days[0]!.activities[0]!.externalImage!.context;
                    const retained = await service.replace("story-owner", board.boardId, board.revision, legacy);
                    assert.deepEqual(retained.days[0]!.activities[0]!.externalImage?.context, illustration);
                    await pool.query("INSERT INTO saved_boards (user_id, board_id) VALUES ('story-author', $1)", [
                        board.boardId
                    ]);
                    const remix = await service.prepareRemix("story-author", board.boardId);
                    assert.deepEqual(remix.days[0]!.activities[0]!.externalImage?.context, illustration);
                    await assert.rejects(
                        pool.query("UPDATE activity SET external_image_context=$1 WHERE board_id=$2", [
                            JSON.stringify({ ...illustration, kind: null }),
                            board.boardId
                        ]),
                        { code: "23514" }
                    );
                    await assert.rejects(
                        pool.query("UPDATE activity SET external_image_context=$1 WHERE board_id=$2", [
                            JSON.stringify({ ...illustration, extra: true }),
                            board.boardId
                        ]),
                        { code: "23514" }
                    );
                    const cleared = write(retained);
                    cleared.days[0]!.activities[0]!.externalImage!.context = null;
                    const saved = await service.replace("story-owner", retained.boardId, retained.revision, cleared);
                    assert.equal(saved.days[0]!.activities[0]!.externalImage?.context, null);
                    const renamed = write(saved);
                    renamed.days[0]!.activities[0]!.externalImage!.providerImageId = "another-photo";
                    delete renamed.days[0]!.activities[0]!.externalImage!.context;
                    const replaced = await service.replace("story-owner", saved.boardId, saved.revision, renamed);
                    assert.equal(replaced.days[0]!.activities[0]!.externalImage?.context, null);
                    await service.delete(board.boardId, "story-owner");
                }
            );

            await context.test(
                "drafts default off, opt-in waits for publication, and provider failure still commits the preference",
                async () => {
                    const fake = provider();
                    const service = createBoardsService(repository, undefined, undefined, fake.value);
                    const draft = await service.create("story-owner", {
                        ...input(),
                        status: "draft",
                        fillerImagesEnabled: undefined
                    });
                    assert.equal(draft.fillerImagesEnabled, false);
                    assert.equal(draft.fillerImageStatus, "disabled");
                    const optedIn = await service.replace("story-owner", draft.boardId, draft.revision, {
                        ...write(draft),
                        fillerImagesEnabled: true
                    });
                    assert.equal(optedIn.fillerImageStatus, "pending");
                    assert.deepEqual(fake.calls, { searches: [], selections: [] });
                    fake.state.fail = true;
                    const published = await service.replace("story-owner", draft.boardId, optedIn.revision, {
                        ...write(optedIn),
                        status: "published"
                    });
                    assert.equal(published.fillerImagesEnabled, true);
                    assert.equal(published.fillerImageStatus, "unavailable");
                    assert.deepEqual(published.fillerImages, []);
                    assert.equal((await repository.getBoard(published.boardId, null))?.fillerImagesEnabled, true);
                }
            );

            await context.test(
                "disabled pools stay stored and hidden, re-enabling and cosmetic edits retain the exact selection",
                async () => {
                    const fake = provider();
                    const service = createBoardsService(repository, undefined, undefined, fake.value);
                    const initial = await service.create("story-owner", input());
                    assert.equal(initial.fillerImageStatus, "ready");
                    assert.equal(initial.fillerImages.length, 3);
                    const persisted = await repository.getFillerPool(initial.boardId);
                    const disabled = await service.replace("story-owner", initial.boardId, initial.revision, {
                        ...write(initial),
                        fillerImagesEnabled: false
                    });
                    assert.equal(disabled.fillerImageStatus, "disabled");
                    assert.deepEqual(disabled.fillerImages, []);
                    assert.deepEqual(await repository.getFillerPool(initial.boardId), persisted);
                    const enabled = await service.replace("story-owner", initial.boardId, disabled.revision, {
                        ...write(disabled),
                        fillerImagesEnabled: true,
                        title: "A renamed story",
                        destination: { ...initial.destination!, name: "Kyoto City", latitude: 35.02 }
                    });
                    assert.deepEqual(enabled.fillerImages, initial.fillerImages);
                    assert.equal(fake.calls.searches.length, 1);
                    const omitted = await service.replace("story-owner", enabled.boardId, enabled.revision, {
                        ...write(enabled),
                        fillerImagesEnabled: undefined
                    });
                    assert.equal(omitted.fillerImagesEnabled, true);
                    assert.deepEqual(omitted.fillerImages, initial.fillerImages);
                }
            );

            await context.test(
                "destination changes replace old references and authorized GETs never call providers",
                async () => {
                    const fake = provider();
                    const service = createBoardsService(repository, undefined, undefined, fake.value);
                    const initial = await service.create("story-owner", input());
                    const originalKey = (await repository.getFillerPool(initial.boardId))!.destinationKey;
                    fake.state.prefix = "osaka";
                    const changed = await service.replace("story-owner", initial.boardId, initial.revision, {
                        ...write(initial),
                        destination: { ...initial.destination!, name: "Osaka", externalPlaceId: "geoapify:osaka" }
                    });
                    assert.deepEqual(
                        new Set(changed.fillerImages.map((image) => image.providerImageId)),
                        new Set(["osaka-0", "osaka-1", "osaka-2"])
                    );
                    assert.notEqual((await repository.getFillerPool(changed.boardId))?.destinationKey, originalKey);
                    const before = structuredClone(fake.calls);
                    const app = createApp({ boardRepository: repository, fillerProvider: fake.value });
                    for (const attempt of [1, 2]) {
                        const response = await request(app).get(`/api/v1/boards/${changed.boardId}`);
                        assert.equal(response.status, 200, `Authorized read ${attempt}`);
                        assert.deepEqual(response.body.data.fillerImages, changed.fillerImages);
                    }
                    assert.deepEqual(fake.calls, before);
                    const restricted = await service.replace("story-owner", changed.boardId, changed.revision, {
                        ...write(changed),
                        visibility: "collaborators"
                    });
                    const denied = await request(app).get(`/api/v1/boards/${restricted.boardId}`);
                    assert.equal(denied.status, 404);
                    assert.equal(denied.body.data, undefined);
                    assert.deepEqual(fake.calls, before);
                }
            );

            await context.test(
                "the transaction rechecks revisions after provider work races a newer save",
                async () => {
                    const initial = await createBoardsService(repository).create("story-owner", {
                        ...input(),
                        fillerImagesEnabled: false
                    });
                    const entered = signal();
                    const release = signal();
                    const fake = provider("stale");
                    const slow: FillerProvider = {
                        ...fake.value,
                        async search(query) {
                            entered.resolve();
                            await release.promise;
                            return fake.value.search(query);
                        }
                    };
                    const pending = createBoardsService(repository, undefined, undefined, slow).replace(
                        "story-owner",
                        initial.boardId,
                        initial.revision,
                        { ...write(initial), fillerImagesEnabled: true, title: "Stale title" }
                    );
                    const rejected = assert.rejects(pending, { statusCode: 409, code: "STALE_BOARD_REVISION" });
                    try {
                        await entered.promise;
                        const winner = await createBoardsService(repository).replace(
                            "story-owner",
                            initial.boardId,
                            initial.revision,
                            { ...write(initial), title: "Newer title" }
                        );
                        release.resolve();
                        await rejected;
                        assert.deepEqual(await repository.getBoard(initial.boardId, "story-owner"), winner);
                        assert.equal(await repository.getFillerPool(initial.boardId), null);
                        const stalePool: FillerPool = {
                            destinationKey: "stale",
                            images: [{ ...photo("stale"), position: 0 }]
                        };
                        await assert.rejects(
                            repository.saveBoard(
                                "story-owner",
                                initial.boardId,
                                initial.revision,
                                { ...write(winner), fillerImagesEnabled: true },
                                stalePool
                            ),
                            { statusCode: 409, code: "STALE_BOARD_REVISION" }
                        );
                        assert.deepEqual(await repository.getBoard(initial.boardId, "story-owner"), winner);
                    } finally {
                        release.resolve();
                        await rejected;
                    }
                }
            );

            await context.test("the commit rechecks editor permission after optional provider work", async () => {
                const initial = await createBoardsService(repository).create("story-owner", {
                    ...input(),
                    fillerImagesEnabled: false
                });
                await pool.query(
                    "INSERT INTO board_member (board_id, user_id, role) VALUES ($1, 'story-editor', 'editor')",
                    [initial.boardId]
                );
                const entered = signal();
                const release = signal();
                const fake = provider("revoked");
                const slow: FillerProvider = {
                    ...fake.value,
                    async search(query) {
                        entered.resolve();
                        await release.promise;
                        return fake.value.search(query);
                    }
                };
                const pending = createBoardsService(repository, undefined, undefined, slow).replace(
                    "story-editor",
                    initial.boardId,
                    initial.revision,
                    { ...write(initial), fillerImagesEnabled: true }
                );
                const rejected = assert.rejects(pending, { statusCode: 403, code: "FORBIDDEN" });
                try {
                    await entered.promise;
                    await pool.query("DELETE FROM board_member WHERE board_id=$1 AND user_id='story-editor'", [
                        initial.boardId
                    ]);
                    release.resolve();
                    await rejected;
                    assert.deepEqual(await repository.getBoard(initial.boardId, "story-owner"), initial);
                    assert.equal(await repository.getFillerPool(initial.boardId), null);
                } finally {
                    release.resolve();
                    await rejected;
                }
            });

            await context.test(
                "document and comment-page totals agree beyond page one and after physical deletion",
                async () => {
                    const board = await createBoardsService(repository).create("story-owner", {
                        ...input(),
                        fillerImagesEnabled: false
                    });
                    const commentsRepository = createCommentsRepository();
                    const comments = createCommentsService(repository, commentsRepository);
                    for (let index = 0; index < 27; index++)
                        await comments.create(board.boardId, "story-author", `Comment ${index}`);
                    const first = await comments.list(board.boardId, null);
                    assert.equal(first.data.length, 20);
                    assert.equal(first.meta.totalCount, 27);
                    const second = await comments.list(board.boardId, null, first.meta.nextCursor!);
                    assert.equal(second.data.length, 7);
                    assert.equal(second.meta.totalCount, 27);
                    assert.equal((await repository.getBoard(board.boardId, null))?.commentCount, 27);
                    await comments.delete(board.boardId, first.data[0]!.commentId, "story-owner");
                    assert.equal((await comments.list(board.boardId, null)).meta.totalCount, 26);
                    assert.equal((await repository.getBoard(board.boardId, null))?.commentCount, 26);
                    await createBoardsService(repository).delete(board.boardId, "story-owner");
                    assert.equal(await commentsRepository.count(board.boardId), 0);
                }
            );

            await context.test(
                "database constraints bound and deduplicate the pool, reject bad dimensions, and cascade references",
                async () => {
                    const fake = provider();
                    const service = createBoardsService(repository, undefined, undefined, fake.value);
                    const board = await service.create("story-owner", input());
                    const stored = await repository.getFillerPool(board.boardId);
                    assert.ok(stored);
                    const clone = `INSERT INTO board_filler_image (board_id,destination_key,position,provider_image_id,url,thumbnail_url,large_url,width,height,alt,photographer,photographer_url,source_url)
                SELECT board_id,destination_key,$2,$3,url,thumbnail_url,large_url,$4,height,alt,photographer,photographer_url,source_url
                FROM board_filler_image WHERE board_id=$1 AND position=0`;
                    await assert.rejects(pool.query(clone, [board.boardId, 3, "fourth", 6000]), { code: "23514" });
                    await pool.query("DELETE FROM board_filler_image WHERE board_id=$1 AND position=2", [
                        board.boardId
                    ]);
                    await assert.rejects(
                        pool.query(clone, [board.boardId, 2, stored.images[0]!.providerImageId, 6000]),
                        { code: "23505" }
                    );
                    await assert.rejects(pool.query(clone, [board.boardId, 2, "bad-dimensions", 0]), { code: "23514" });
                    await service.delete(board.boardId, "story-owner");
                    assert.equal(
                        (await pool.query("SELECT 1 FROM board_filler_image WHERE board_id=$1", [board.boardId]))
                            .rowCount,
                        0
                    );
                }
            );
        } finally {
            await closeDatabase();
            if (originalUrl === undefined) delete process.env.DATABASE_URL;
            else process.env.DATABASE_URL = originalUrl;
            try {
                if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
            } finally {
                await admin.end();
            }
        }
    }
);
