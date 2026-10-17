import type { RequestHandler } from "express";
import type { ProfileChanges } from "./users.types.js";
import { createUsersService } from "./users.service.js";

export function createUsersController(service: ReturnType<typeof createUsersService>) {
    return {
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
            const { scope } = response.locals.query as { scope?: "visited" };
            response.json({ data: await service.mapDestinations(response.locals.user.userId, scope === "visited") });
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
        }
    } satisfies Record<string, RequestHandler>;
}
