import type { RequestHandler } from "express";
import type { ProfileChanges } from "./users.types.js";
import { createUsersService } from "./users.service.js";

export function createUsersController(service: ReturnType<typeof createUsersService>) {
    return {
        publicRead: async (_request, response) => {
            const { handle } = response.locals.params as { handle: string };
            response.json({ data: await service.publicProfile(handle, response.locals.user?.userId ?? null) });
        },
        languages: async (_request, response) => {
            response.json({ data: service.languages() });
        },
        read: async (_request, response) => {
            response.json({ data: await service.read(response.locals.user.userId) });
        },
        update: async (request, response) => {
            response.json({ data: await service.update(response.locals.user.userId, request.body as ProfileChanges) });
        },
        setPicture: async (request, response) => {
            response.json({
                data: await service.setPicture(response.locals.user.userId, request.body.imageId as number)
            });
        },
        deletePicture: async (_request, response) => {
            response.json({ data: await service.setPicture(response.locals.user.userId, null) });
        },
        boards: async (_request, response) => {
            response.json({ data: await service.listBoards(response.locals.user.userId) });
        },
        recent: async (_request, response) => {
            response.json({ data: await service.listBoards(response.locals.user.userId, true) });
        },
        stats: async (_request, response) => {
            response.json({ data: await service.stats(response.locals.user.userId) });
        },
        destinations: async (_request, response) => {
            const { scope } = response.locals.query as { scope?: "visited" | "published" | "saved" };
            response.json({
                data: await service.mapDestinations(response.locals.user.userId, scope === "visited", scope === "saved")
            });
        },
        savedMapDestinations: async (_request, response) => {
            const { handle } = response.locals.params as { handle: string };
            response.json({ data: await service.savedMapDestinations(handle, response.locals.user.userId) });
        },
        savedBoards: async (_request, response) => {
            const { page, limit } = response.locals.query as { page: number; limit: number };
            const result = await service.listSavedBoards(response.locals.user.userId, page, limit);
            response.json({ data: result.items, meta: { page, limit, hasMore: result.hasMore } });
        },
        saveBoard: async (_request, response) => {
            const { boardId } = response.locals.params as { boardId: number };
            const created = await service.saveBoard(response.locals.user.userId, boardId);
            response.status(created ? 201 : 200).json({ data: { boardId, saved: true } });
        },
        unsaveBoard: async (_request, response) => {
            const { boardId } = response.locals.params as { boardId: number };
            await service.unsaveBoard(response.locals.user.userId, boardId);
            response.status(204).send();
        },
        sendFriendRequest: async (_request, response) => {
            const { handle } = response.locals.params as { handle: string };
            const result = await service.sendFriendRequest(response.locals.user.userId, handle);
            response.status(201).json({ data: result });
        },
        listFriendRequests: async (_request, response) => {
            response.json({ data: await service.listFriendRequests(response.locals.user.userId) });
        },
        acceptFriendRequest: async (_request, response) => {
            const { requestId } = response.locals.params as { requestId: number };
            const result = await service.acceptFriendRequest(response.locals.user.userId, requestId);
            response.json({ data: result });
        },
        rejectFriendRequest: async (_request, response) => {
            const { requestId } = response.locals.params as { requestId: number };
            await service.rejectFriendRequest(response.locals.user.userId, requestId);
            response.status(204).send();
        },
        friends: async (_request, response) => {
            response.json({ data: await service.listFriends(response.locals.user.userId) });
        },
        search: async (_request, response) => {
            const { q, limit } = response.locals.query as { q: string; limit: number };
            response.json({ data: await service.searchUsers(response.locals.user.userId, q, limit) });
        },
        friendsBoards: async (_request, response) => {
            const { limit } = response.locals.query as { limit: number };
            response.json({ data: await service.listFriendsBoards(response.locals.user.userId, limit) });
        },
        friendsActivity: async (_request, response) => {
            const { limit } = response.locals.query as { limit: number };
            response.json({ data: await service.listFriendsActivity(response.locals.user.userId, limit) });
        },
        removeFriend: async (_request, response) => {
            const { targetUserId } = response.locals.params as { targetUserId: string };
            await service.removeFriend(response.locals.user.userId, targetUserId);
            response.status(204).send();
        },
        removeFriendByHandle: async (_request, response) => {
            const { handle } = response.locals.params as { handle: string };
            await service.removeFriendByHandle(response.locals.user.userId, handle);
            response.status(204).send();
        }
    } satisfies Record<string, RequestHandler>;
}
