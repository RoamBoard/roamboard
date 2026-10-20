import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Client } from "pg";
import { closeDatabase } from "../src/db.js";
import { createDiscoveryRepository } from "../src/features/board-discovery/discovery.repository.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
test(
    "discovery migration enforces three-second views, one-use tokens, browser merging and active unique saves",
    {
        skip: databaseUrl ? undefined : "TEST_DATABASE_URL or DATABASE_URL is required"
    },
    async () => {
        const schema = `rb_discovery_test_${randomBytes(6).toString("hex")}`;
        const admin = new Client({ connectionString: databaseUrl });
        const originalUrl = process.env.DATABASE_URL;
        await admin.connect();
        try {
            await admin.query(`CREATE SCHEMA ${schema}`);
            const url = new URL(databaseUrl!);
            url.searchParams.set("options", `-csearch_path=${schema}`);
            process.env.DATABASE_URL = url.toString();
            const client = new Client({ connectionString: url.toString() });
            await client.connect();
            try {
                for (const name of [
                    "001_initial.sql",
                    "002_auth_session.sql",
                    "003_board_creator.sql",
                    "004_api_features.sql",
                    "006_profile.sql",
                    "008_board_destination.sql",
                    "011_board_published_at.sql",
                    "013_board_comments.sql",
                    "015_friendship_accepted_at.sql",
                    "018_board_discovery.sql"
                ])
                    await client.query(await readFile(new URL(`../db/migrations/${name}`, import.meta.url), "utf8"));
                await client.query(`INSERT INTO app_user(user_id,username,display_name) VALUES
                ('owner','owner','Owner'),('reader','reader','Reader')`);
                const inserted = await client.query<{
                    board_id: number;
                }>(`INSERT INTO board(owner_user_id,title,status,visibility)
                VALUES('owner','Discovery test','published','public') RETURNING board_id`);
                const id = inserted.rows[0]!.board_id;
                const repository = createDiscoveryRepository();
                const browser = await repository.browser(null, null);
                const guestKey = `g:${browser}`;
                const token = await repository.startView(id, guestKey);
                assert.equal(
                    await repository.finishView(id, guestKey, token, null),
                    false,
                    "immediate confirmation must not count"
                );
                await client.query("UPDATE board_view_challenge SET started_at=clock_timestamp()-INTERVAL '4 seconds'");
                assert.equal(await repository.finishView(id, guestKey, token, null), true);
                assert.equal(await repository.finishView(id, guestKey, token, null), false, "token must be consumed");
                await client.query(
                    "INSERT INTO board_view(board_id,viewer_key,user_id) VALUES($1,'u:reader','reader')",
                    [id]
                );
                await repository.mergeBrowser(browser, "reader");
                const views = await client.query("SELECT viewer_key,user_id FROM board_view WHERE board_id=$1", [id]);
                assert.deepEqual(views.rows, [{ viewer_key: "u:reader", user_id: "reader" }]);
                assert.notEqual(await repository.browser(browser, null), browser, "logout must rotate linked identity");
                await client.query("INSERT INTO saved_boards(board_id,user_id) VALUES($1,'reader')", [id]);
                await client.query("DELETE FROM saved_boards WHERE board_id=$1", [id]);
                await client.query("INSERT INTO saved_boards(board_id,user_id) VALUES($1,'reader')", [id]);
                assert.equal(
                    (await client.query("SELECT COUNT(*)::int AS count FROM board_save_event WHERE board_id=$1", [id]))
                        .rows[0].count,
                    1
                );
                await client.query(
                    "INSERT INTO board_comment(board_id,author_user_id,body) VALUES($1,'reader','One'),($1,'reader','Two'),($1,'owner','Owner comment')",
                    [id]
                );
                const active = (await repository.candidates("reader", "discovery", 30))[0]!;
                assert.equal(active.viewers, 1);
                assert.equal(active.guests, 0);
                assert.equal(active.savers, 1);
                assert.equal(active.commenters, 1, "multiple comments and owner comments cannot inflate score");
                await client.query("DELETE FROM saved_boards WHERE board_id=$1", [id]);
                await client.query("DELETE FROM board_comment WHERE board_id=$1 AND author_user_id='reader'", [id]);
                const removed = (await repository.candidates("reader", "discovery", 30))[0]!;
                assert.equal(removed.savers, 0);
                assert.equal(removed.commenters, 0);
                await client.query("INSERT INTO saved_boards(board_id,user_id) VALUES($1,'reader')", [id]);
                await client.query("UPDATE board SET visibility='friends' WHERE board_id=$1", [id]);
                assert.equal((await repository.candidates(null, "discovery")).length, 0);
                assert.equal((await repository.candidates("reader", "saved")).length, 0);
                await client.query(
                    "INSERT INTO friendship(requester_user_id,recipient_user_id,status) VALUES('owner','reader','accepted')"
                );
                assert.equal((await repository.candidates("reader", "discovery")).length, 1);
                assert.equal((await repository.candidates("reader", "saved")).length, 1);
                await client.query("DELETE FROM friendship");
                assert.equal((await repository.candidates("reader", "saved")).length, 0);
                assert.equal(
                    (await client.query("SELECT COUNT(*)::int AS count FROM saved_boards WHERE board_id=$1", [id]))
                        .rows[0].count,
                    1,
                    "access loss hides the card without destroying its saved relationship"
                );
                await client.query("UPDATE board SET visibility='public' WHERE board_id=$1", [id]);
                const fresh = await repository.browser(null, null);
                const expired = await repository.startView(id, `g:${fresh}`);
                await client.query("UPDATE board_view_challenge SET started_at=clock_timestamp()-INTERVAL '3 minutes'");
                assert.equal(await repository.finishView(id, `g:${fresh}`, expired, null), false);
                const collection = { page: 1, limit: 20 };
                assert.equal(
                    (
                        await repository.candidates("reader", "discovery", undefined, {
                            ...collection,
                            context: "friends"
                        })
                    ).length,
                    0
                );
                await client.query(
                    "INSERT INTO friendship(requester_user_id,recipient_user_id,status) VALUES('owner','reader','accepted')"
                );
                assert.equal(
                    (
                        await repository.candidates("reader", "discovery", undefined, {
                            ...collection,
                            context: "friends"
                        })
                    ).length,
                    1
                );
                assert.equal(
                    (
                        await repository.candidates(null, "discovery", undefined, {
                            ...collection,
                            context: "profile",
                            handle: "owner"
                        })
                    ).length,
                    1
                );
                const savedCollection = await repository.candidates(null, "discovery", undefined, {
                    ...collection,
                    context: "profile-saved",
                    handle: "reader"
                });
                assert.equal(savedCollection.length, 1);
                assert.ok(savedCollection[0]!.savedAt, "use the collection owner's save timestamp, even for guests");
                assert.equal(await repository.canReadSavedMap!(null, "reader"), false);
                assert.equal(await repository.canReadSavedMap!("owner", "reader"), true);
                await client.query(
                    "INSERT INTO location(name,city,country,latitude,longitude) VALUES('Bali',NULL,'IDN',-8.4,115.1)"
                );
                await client.query(
                    "UPDATE board SET primary_location_kind='region',primary_location_id=(SELECT location_id FROM location LIMIT 1) WHERE board_id=$1",
                    [id]
                );
                assert.equal(
                    (
                        await repository.candidates("owner", "discovery", undefined, {
                            ...collection,
                            context: "map",
                            handle: "reader",
                            collection: "saved",
                            country: "IDN"
                        })
                    ).length,
                    1
                );
                assert.equal(
                    (
                        await repository.candidates("owner", "discovery", undefined, {
                            ...collection,
                            context: "map",
                            handle: "reader",
                            collection: "saved",
                            country: "SWE"
                        })
                    ).length,
                    0
                );
                assert.equal(
                    (
                        await repository.candidates("owner", "discovery", undefined, {
                            ...collection,
                            context: "map",
                            handle: "reader",
                            collection: "saved",
                            longitude: 115.1,
                            latitude: -8.4
                        })
                    ).length,
                    1
                );
                await client.query("UPDATE board SET visibility='collaborators' WHERE board_id=$1", [id]);
                assert.equal(
                    (
                        await repository.candidates(null, "discovery", undefined, {
                            ...collection,
                            context: "profile-saved",
                            handle: "reader"
                        })
                    ).length,
                    0
                );
                assert.equal(
                    (
                        await repository.candidates("owner", "mine", undefined, {
                            ...collection,
                            context: "mine",
                            status: "published"
                        })
                    ).length,
                    1
                );
            } finally {
                await client.end();
            }
        } finally {
            await closeDatabase();
            if (originalUrl === undefined) delete process.env.DATABASE_URL;
            else process.env.DATABASE_URL = originalUrl;
            await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
            await admin.end();
        }
    }
);
