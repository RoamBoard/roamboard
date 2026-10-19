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
