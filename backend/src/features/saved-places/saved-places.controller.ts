import type { RequestHandler } from "express";
import type { createSavedPlacesService } from "./saved-places.service.js";

// HTTP responses use the same envelope as the other account endpoints.
export function createSavedPlacesController(service: ReturnType<typeof createSavedPlacesService>) {
    return {
        list: async (_req, res) => res.json({ data: await service.list(res.locals.user.userId) }),
        save: async (req, res) => res.json({ data: await service.save(res.locals.user.userId, req.body) }),
        remove: async (req, res) => {
            await service.remove(res.locals.user.userId, res.locals.params.placeId as string);
            res.status(204).end();
        }
    } satisfies Record<string, RequestHandler>;
}
