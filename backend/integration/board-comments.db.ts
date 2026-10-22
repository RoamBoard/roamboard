import "dotenv/config";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Client } from "pg";

import { closeDatabase } from "../src/db.js";
import { createCommentsRepository } from "../src/features/board-comments/board-comments.repository.js";
import { createNotificationsRepository } from "../src/features/board-comment-notifications/notifications.repository.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

test(
    "comment migration and repository preserve ordering, revisions and deletion cascades",
    {
        skip: databaseUrl ? undefined : "TEST_DATABASE_URL or DATABASE_URL is required"
    },
    async () => {
        const schema = `rb_comment_test_${randomBytes(6).toString("hex")}`;
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
                    "011_board_published_at.sql",
                    "015_friendship_accepted_at.sql",
                    "013_board_comments.sql",
                    "014_board_comment_notifications.sql",
                    "016_board_comment_mentions.sql",
                    "017_board_comment_multiple_handles.sql"
                ])
                    await client.query(await readFile(new URL(`../db/migrations/${name}`, import.meta.url), "utf8"));

                await client.query(`INSERT INTO app_user (user_id, username, display_name) VALUES
                ('owner', 'owner', 'Owner'), ('author', 'author', 'Author')`);
                const board = await client.query<{ board_id: number }>(
                    "INSERT INTO board (owner_user_id, title, visibility) VALUES ('owner', 'Test Board', 'public') RETURNING board_id"
                );
                const boardId = board.rows[0]!.board_id;
                const repository = createCommentsRepository();
                const notifications = createNotificationsRepository();
                await assert.rejects(
                    client.query(
                        "INSERT INTO board_comment (board_id, author_user_id, body) VALUES ($1, 'author', $2)",
                        [boardId, "🙂".repeat(2001)]
                    ),
                    /ck_board_comment_body/
                );
                await assert.rejects(
                    client.query(
                        "INSERT INTO board_comment (board_id, author_user_id, body) VALUES ($1, 'author', $2)",
                        [boardId, " \n\t "]
                    ),
                    /ck_board_comment_body/
                );
                const first = await repository.create(boardId, "author", "first");
                const second = await repository.create(boardId, "author", "second");
                assert.equal(await notifications.preference(boardId, "author"), true);
                assert.equal(await notifications.unreadCount("owner"), 2);
                assert.equal(await notifications.unreadCount("author"), 0);
                await client.query(
                    "INSERT INTO app_user (user_id, username, display_name) VALUES ('third', 'third', 'Third')"
                );
                await notifications.setPreference(boardId, "third", false);
                const third = await repository.create(boardId, "third", "third comment");
                assert.equal(await notifications.preference(boardId, "third"), false);
                assert.equal(await notifications.unreadCount("owner"), 3);
                assert.equal(await notifications.unreadCount("author"), 1);
                assert.equal(await notifications.unreadCount("third"), 0);
                const authorNotification = (await notifications.list("author", null, 10))[0]!;
                assert.equal(authorNotification.commentId, third.commentId);
                assert.equal(
                    (await notifications.markRead("author", authorNotification.notificationId))?.notificationId,
                    authorNotification.notificationId
                );
                assert.equal(await notifications.unreadCount("author"), 0);
                assert.equal(await notifications.markRead("third", authorNotification.notificationId), null);
                await client.query("UPDATE board SET visibility = 'collaborators' WHERE board_id = $1", [boardId]);
                assert.equal((await notifications.list("author", null, 10)).length, 0);
                assert.equal((await notifications.list("owner", null, 10)).length, 3);
                assert.equal(first.revision, 1);
                assert.deepEqual(
                    (await repository.list(boardId, null, 10)).map((comment) => comment.commentId),
                    [third.commentId, second.commentId, first.commentId]
                );
                const page = await repository.list(boardId, null, 1);
                assert.deepEqual(
                    (
                        await repository.list(
                            boardId,
                            {
                                boardId,
                                createdAt: page[0]!.createdAt,
                                commentId: page[0]!.commentId
                            },
                            10
                        )
                    ).map((comment) => comment.commentId),
                    [second.commentId, first.commentId]
                );
                assert.equal(await repository.update(boardId, first.commentId, "owner", 1, "wrong"), null);
                const edited = await repository.update(boardId, first.commentId, "author", 1, "edited");
                assert.equal(edited?.revision, 2);
                assert.equal(edited?.body, "edited");
                assert.ok(edited?.editedAt);
                assert.equal(await repository.update(boardId, first.commentId, "author", 1, "stale"), null);
                assert.equal(await repository.delete(boardId, first.commentId, "owner", "owner"), true);
                assert.equal(await repository.get(boardId, first.commentId), null);
                await client.query("DELETE FROM board WHERE board_id = $1", [boardId]);
                assert.equal(await repository.get(boardId, second.commentId), null);
                assert.equal(
                    (await client.query("SELECT notification_id FROM board_comment_notification")).rowCount,
                    0
                );
                const anotherBoard = await client.query<{ board_id: number }>(
                    "INSERT INTO board (owner_user_id, title) VALUES ('owner', 'Another Board') RETURNING board_id"
                );
                const authorComment = await repository.create(anotherBoard.rows[0]!.board_id, "author", "bye");
                await client.query("DELETE FROM app_user WHERE user_id = 'author'");
                assert.equal(await repository.get(anotherBoard.rows[0]!.board_id, authorComment.commentId), null);
                const constraint = await client.query<{ conname: string }>(
                    "SELECT conname FROM pg_constraint WHERE conrelid = 'board_comment'::regclass ORDER BY conname"
                );
                assert.ok(constraint.rows.some((row) => row.conname === "ck_board_comment_body"));

                await client.query(
                    "INSERT INTO app_user (user_id, username, display_name) VALUES ('mentioned', 'mentioned', 'Mentioned')"
                );
                const mentionsBoard = await client.query<{ board_id: number }>(
                    "INSERT INTO board (owner_user_id, title, visibility) VALUES ('owner', 'Mentions', 'public') RETURNING board_id"
                );
                const mentionsBoardId = mentionsBoard.rows[0]!.board_id;
                await notifications.setPreference(mentionsBoardId, "mentioned", false);
                const tagged = await repository.create(mentionsBoardId, "third", "Hello @mentioned and @missing");
                assert.deepEqual(tagged.mentions, [{ handle: "mentioned", username: "mentioned" }]);
                const firstMentionNotification = (await notifications.list("mentioned", null, 10))[0]!;
                assert.equal(firstMentionNotification.kind, "mention");
                assert.equal(await notifications.unreadCount("mentioned"), 1);
                await client.query("UPDATE app_user SET username = 'renamed' WHERE user_id = 'mentioned'");
                assert.deepEqual((await repository.get(mentionsBoardId, tagged.commentId))?.mentions, [
                    { handle: "mentioned", username: "renamed" }
                ]);
                const editedTag = await repository.update(
                    mentionsBoardId,
                    tagged.commentId,
                    "third",
                    1,
                    "Hi @mentioned"
                );
                assert.equal(editedTag?.mentions[0]?.username, "renamed");
                const bothHandles = await repository.update(
                    mentionsBoardId,
                    tagged.commentId,
                    "third",
                    2,
                    "Hi @renamed and @mentioned"
                );
                assert.deepEqual(bothHandles?.mentions.map((mention) => mention.handle).sort(), [
                    "mentioned",
                    "renamed"
                ]);
                assert.deepEqual(
                    (await repository.get(mentionsBoardId, tagged.commentId))?.mentions.map(
                        (mention) => mention.username
                    ),
                    ["renamed", "renamed"]
                );
                assert.equal((await notifications.list("mentioned", null, 10)).length, 1);
                await client.query(
                    "INSERT INTO app_user (user_id, username, display_name) VALUES ('newholder', 'mentioned', 'New holder')"
                );
                const retainedHandles = await repository.update(
                    mentionsBoardId,
                    tagged.commentId,
                    "third",
                    3,
                    "Still @renamed and @mentioned"
                );
                assert.deepEqual(
                    retainedHandles?.mentions.map((mention) => mention.username),
                    ["renamed", "renamed"]
                );
                assert.equal((await notifications.list("newholder", null, 10)).length, 0);
                await repository.update(mentionsBoardId, tagged.commentId, "third", 4, "Only @renamed remains");
                assert.equal((await notifications.list("mentioned", null, 10))[0]?.kind, "mention");
                await repository.update(mentionsBoardId, tagged.commentId, "third", 5, "No mention now");
                assert.equal((await notifications.list("mentioned", null, 10)).length, 0);
                await repository.update(mentionsBoardId, tagged.commentId, "third", 6, "Again @renamed");
                const repeatedMentionNotification = (await notifications.list("mentioned", null, 10))[0]!;
                assert.notEqual(repeatedMentionNotification.notificationId, firstMentionNotification.notificationId);
                assert.equal(repeatedMentionNotification.kind, "mention");

                await notifications.setPreference(mentionsBoardId, "mentioned", true);
                const later = await repository.create(mentionsBoardId, "third", "An ordinary comment");
                const ordinaryNotification = (await notifications.list("mentioned", null, 10))[0]!;
                assert.equal(ordinaryNotification.kind, "comment");
                await notifications.markRead("mentioned", ordinaryNotification.notificationId);
                const newlyTagged = await repository.update(
                    mentionsBoardId,
                    later.commentId,
                    "third",
                    1,
                    "An edit for @renamed"
                );
                assert.deepEqual(newlyTagged?.mentions, [{ handle: "renamed", username: "renamed" }]);
                const promotedNotification = (await notifications.list("mentioned", null, 10))[0]!;
                assert.equal(promotedNotification.notificationId, ordinaryNotification.notificationId);
                assert.equal(promotedNotification.kind, "mention");
                assert.equal(promotedNotification.readAt, null);
                await repository.update(mentionsBoardId, later.commentId, "third", 2, "Again for @renamed");
                assert.equal((await notifications.list("mentioned", null, 10)).length, 2);
                await repository.update(mentionsBoardId, later.commentId, "third", 3, "No longer tagged");
                assert.equal(
                    (await notifications.list("mentioned", null, 10)).some(
                        (item) => item.commentId === later.commentId
                    ),
                    false
                );

                const ownerTag = await repository.create(mentionsBoardId, "third", "Hello @owner");
                const ownerMention = (await notifications.list("owner", null, 20)).find(
                    (item) => item.commentId === ownerTag.commentId
                )!;
                assert.equal(ownerMention.kind, "mention");
                await notifications.markRead("owner", ownerMention.notificationId);
                await repository.update(mentionsBoardId, ownerTag.commentId, "third", 1, "No owner mention");
                const ownerComment = (await notifications.list("owner", null, 20)).find(
                    (item) => item.commentId === ownerTag.commentId
                )!;
                assert.equal(ownerComment.notificationId, ownerMention.notificationId);
                assert.equal(ownerComment.kind, "comment");
                assert.ok(ownerComment.readAt);

                await notifications.setPreference(mentionsBoardId, "owner", false);
                const mutedOwnerTag = await repository.create(mentionsBoardId, "third", "Another @owner mention");
                assert.equal(
                    (await notifications.list("owner", null, 20)).find(
                        (item) => item.commentId === mutedOwnerTag.commentId
                    )?.kind,
                    "mention"
                );
                await repository.update(mentionsBoardId, mutedOwnerTag.commentId, "third", 1, "Removed owner tag");
                assert.equal(
                    (await notifications.list("owner", null, 20)).some(
                        (item) => item.commentId === mutedOwnerTag.commentId
                    ),
                    false
                );

                const mentionedUnread = await notifications.list("mentioned", null, 20, true);
                assert.ok(mentionedUnread.some((item) => item.kind === "mention"));
                const ownerUnreadBeforeClear = await notifications.unreadCount("owner");
                await client.query("UPDATE board SET visibility = 'collaborators' WHERE board_id = $1", [
                    mentionsBoardId
                ]);
                assert.equal((await notifications.list("mentioned", null, 20)).length, 0);
                assert.equal(await notifications.unreadCount("mentioned"), 0);
                await notifications.markAllRead("mentioned");
                assert.equal(await notifications.unreadCount("owner"), ownerUnreadBeforeClear);
                await client.query("UPDATE board SET visibility = 'public' WHERE board_id = $1", [mentionsBoardId]);
                assert.deepEqual(await notifications.list("mentioned", null, 20, true), []);
                assert.ok((await notifications.list("mentioned", null, 20)).length > 0);
                await notifications.markAllRead("mentioned");
                await repository.create(mentionsBoardId, "third", "A new @renamed mention");
                assert.equal((await notifications.list("mentioned", null, 20, true))[0]?.kind, "mention");
            } finally {
                await closeDatabase();
                await client.end();
            }
        } finally {
            process.env.DATABASE_URL = originalUrl;
            await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
            await admin.end();
        }
    }
);
