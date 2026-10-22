import assert from "node:assert/strict";
import test from "node:test";
import { createUsersService } from "../src/features/users/users.service.js";
import type { UsersRepository } from "../src/features/users/users.types.js";
import { AppError } from "../src/shared/app-error.js";

test("a cancelled crossed friend request is never reported as accepted", async () => {
    for (const conflictOnInsert of [false, true]) {
        const calls = { lookups: 0, accepts: 0 };
        const repository = {
            async findIdByHandle() {
                return "recipient";
            },
            async getFriendship() {
                calls.lookups += 1;
                if (conflictOnInsert && calls.lookups === 1) return null;
                return {
                    friendshipId: 42,
                    status: "pending" as const,
                    requesterUserId: "recipient",
                    recipientUserId: "owner"
                };
            },
            async sendFriendRequest() {
                throw Object.assign(new Error("duplicate friendship"), { code: "23505" });
            },
            async acceptFriendRequest() {
                calls.accepts += 1;
                return false;
            }
        } as unknown as UsersRepository;
        const service = createUsersService(
            repository,
            {} as Parameters<typeof createUsersService>[1],
            {} as Parameters<typeof createUsersService>[2]
        );

        await assert.rejects(
            () => service.sendFriendRequest("owner", "recipient"),
            (error: unknown) => error instanceof AppError && error.statusCode === 404 && error.code === "NOT_FOUND"
        );
        assert.equal(calls.accepts, 1);
        assert.equal(calls.lookups, conflictOnInsert ? 2 : 1);
    }
});

test("publicFriends returns friends for an existing user handle", async () => {
    const mockFriends = [
        {
            friendshipId: 1,
            acceptedAt: "2026-10-20T10:00:00.000Z",
            userId: "u-bob",
            username: "bob",
            displayName: "Bob",
            profilePictureUrl: null,
            bio: "Traveler",
            location: "Berlin"
        }
    ];
    const repository = {
        async findIdByHandle(handle: string) {
            return handle === "alice" ? "u-alice" : null;
        },
        async listFriends(userId: string) {
            return userId === "u-alice" ? mockFriends : [];
        }
    } as unknown as UsersRepository;

    const service = createUsersService(
        repository,
        {} as Parameters<typeof createUsersService>[1],
        {} as Parameters<typeof createUsersService>[2]
    );

    const friends = await service.publicFriends("alice");
    assert.deepEqual(friends, mockFriends);

    await assert.rejects(
        () => service.publicFriends("nonexistent"),
        (error: unknown) => error instanceof AppError && error.statusCode === 404 && error.code === "NOT_FOUND"
    );
});
