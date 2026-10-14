import type { RequestHandler } from "express";
import type { ProfileChanges } from "./users.types.js";
import { createUsersService } from "./users.service.js";

export function createUsersController(service: ReturnType<typeof createUsersService>) {
    return {
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
            response.json({ data: await service.mapDestinations(response.locals.user.userId) });
        }
    } satisfies Record<string, RequestHandler>;
}
