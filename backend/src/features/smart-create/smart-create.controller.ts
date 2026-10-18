import type { RequestHandler } from "express";
import type { AppUser } from "../auth/auth.types.js";
import type { createSmartCreateService } from "./smart-create.service.js";
export function createSmartCreateController(service: ReturnType<typeof createSmartCreateService>): {
    suggest: RequestHandler;
    refresh: RequestHandler;
} {
    return {
        refresh: async (_request, response) => {
            const user = response.locals.user as AppUser;
            const { imageId } = response.locals.params as { imageId: number };
            response.json({ data: await service.refresh(user.userId, imageId) });
        },
        suggest: async (request, response) => {
            const user = response.locals.user as AppUser;
            response.json({
                data: await service.suggest(user.userId, (request.body as { imageIds: number[] }).imageIds)
            });
        }
    };
}
