import assert from "node:assert/strict";
import test from "node:test";
import { createUsersRepository } from "../src/features/users/users.repository.js";

test("acceptFriendRequest updates accepted_at normally when column exists", async () => {
    const executedQueries: string[] = [];
    const mockDb = {
        async query(sql: string, params: unknown[]) {
            executedQueries.push(sql);
            assert.deepEqual(params, [10, "alice"]);
            return { rowCount: 1 };
        }
    };

    const repository = createUsersRepository(mockDb);
    const accepted = await repository.acceptFriendRequest("alice", 10);

    assert.equal(accepted, true);
    assert.equal(executedQueries.length, 1);
    assert.ok(executedQueries[0].includes("accepted_at = CURRENT_TIMESTAMP"));
});

test("acceptFriendRequest falls back to unmigrated query when column does not exist (42703)", async () => {
    const executedQueries: string[] = [];
    const mockDb = {
        async query(sql: string, params: unknown[]) {
            executedQueries.push(sql);
            if (executedQueries.length === 1) {
                const err = new Error("column accepted_at does not exist");
                Object.assign(err, { code: "42703" });
                throw err;
            }
            assert.deepEqual(params, [10, "alice"]);
            return { rowCount: 1 };
        }
    };

    const repository = createUsersRepository(mockDb);
    const accepted = await repository.acceptFriendRequest("alice", 10);

    assert.equal(accepted, true);
    assert.equal(executedQueries.length, 2);
    assert.ok(executedQueries[0].includes("accepted_at = CURRENT_TIMESTAMP"));
    assert.ok(!executedQueries[1].includes("accepted_at"));
    assert.ok(executedQueries[1].includes("SET status = 'accepted'"));
});

test("acceptFriendRequest lets non-42703 errors escape", async () => {
    const mockDb = {
        async query() {
            const err = new Error("connection terminated");
            Object.assign(err, { code: "08006" });
            throw err;
        }
    };

    const repository = createUsersRepository(mockDb);
    await assert.rejects(
        () => repository.acceptFriendRequest("alice", 10),
        (error: unknown) => error instanceof Error && (error as { code?: string }).code === "08006"
    );
});

test("listFriends maps rows with acceptedAt timestamp when column exists", async () => {
    const acceptedDate = new Date("2026-10-19T17:00:00.000Z");
    const executedQueries: string[] = [];
    const mockDb = {
        async query(sql: string, params: unknown[]) {
            executedQueries.push(sql);
            assert.deepEqual(params, ["user-1"]);
            return {
                rows: [
                    {
                        friendship_id: 42,
                        accepted_at: acceptedDate,
                        user_id: "user-2",
                        username: "bob",
                        display_name: "Bob Traveler",
                        profile_picture_image_id: 101,
                        biography: "Explorer",
                        location: "Paris"
                    }
                ]
            };
        }
    };

    const repository = createUsersRepository(mockDb);
    const friends = await repository.listFriends("user-1");

    assert.equal(executedQueries.length, 1);
    assert.ok(executedQueries[0].includes("f.accepted_at"));
    assert.deepEqual(friends, [
        {
            friendshipId: 42,
            acceptedAt: "2026-10-19T17:00:00.000Z",
            userId: "user-2",
            username: "bob",
            displayName: "Bob Traveler",
            profilePictureUrl: "/api/v1/images/101/content?variant=thumbnail&profileHandle=bob",
            bio: "Explorer",
            location: "Paris"
        }
    ]);
});

test("listFriends falls back to NULL accepted_at when column does not exist (42703)", async () => {
    const executedQueries: string[] = [];
    const mockDb = {
        async query(sql: string, params: unknown[]) {
            executedQueries.push(sql);
            if (executedQueries.length === 1) {
                const err = new Error("column f.accepted_at does not exist");
                Object.assign(err, { code: "42703" });
                throw err;
            }
            assert.deepEqual(params, ["user-1"]);
            return {
                rows: [
                    {
                        friendship_id: 42,
                        accepted_at: null,
                        user_id: "user-2",
                        username: "bob",
                        display_name: "Bob Traveler",
                        profile_picture_image_id: null,
                        biography: null,
                        location: null
                    }
                ]
            };
        }
    };

    const repository = createUsersRepository(mockDb);
    const friends = await repository.listFriends("user-1");

    assert.equal(executedQueries.length, 2);
    assert.ok(executedQueries[0].includes("f.accepted_at"));
    assert.ok(executedQueries[1].includes("NULL::timestamptz AS accepted_at"));
    assert.deepEqual(friends, [
        {
            friendshipId: 42,
            acceptedAt: null,
            userId: "user-2",
            username: "bob",
            displayName: "Bob Traveler",
            profilePictureUrl: null,
            bio: null,
            location: null
        }
    ]);
});

test("listFriends lets non-42703 errors escape", async () => {
    const mockDb = {
        async query() {
            const err = new Error("syntax error");
            Object.assign(err, { code: "42601" });
            throw err;
        }
    };

    const repository = createUsersRepository(mockDb);
    await assert.rejects(
        () => repository.listFriends("user-1"),
        (error: unknown) => error instanceof Error && (error as { code?: string }).code === "42601"
    );
});
