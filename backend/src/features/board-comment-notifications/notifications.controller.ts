import type { RequestHandler } from "express";

import type { AppUser } from "../auth/auth.types.js";
import type { createNotificationsService } from "./notifications.service.js";

type NotificationsService = ReturnType<typeof createNotificationsService>;

export function createNotificationsController(service: NotificationsService): {
    subscription: RequestHandler;
    setSubscription: RequestHandler;
    list: RequestHandler;
    markRead: RequestHandler;
    markAllRead: RequestHandler;
} {
    return {
        subscription: async (_request, response) => {
            const { boardId } = response.locals.params as { boardId: number };
            const user = response.locals.user as AppUser;
            response.set("Cache-Control", "no-store").json({ data: await service.subscription(boardId, user.userId) });
        },
        setSubscription: async (request, response) => {
            const { boardId } = response.locals.params as { boardId: number };
            const user = response.locals.user as AppUser;
            const { enabled } = request.body as { enabled: boolean };
            response
                .set("Cache-Control", "no-store")
                .json({ data: await service.setSubscription(boardId, user.userId, enabled) });
        },
        list: async (_request, response) => {
            const user = response.locals.user as AppUser;
            const { cursor, unreadOnly } = response.locals.query as { cursor?: string; unreadOnly?: "true" | "false" };
            response
                .set("Cache-Control", "no-store")
                .json(await service.list(user.userId, cursor, unreadOnly === "true"));
        },
        markRead: async (_request, response) => {
            const user = response.locals.user as AppUser;
            const { notificationId } = response.locals.params as { notificationId: number };
            response
                .set("Cache-Control", "no-store")
                .json({ data: await service.markRead(user.userId, notificationId) });
        },
        markAllRead: async (_request, response) => {
            const user = response.locals.user as AppUser;
            response.set("Cache-Control", "no-store").json({ data: await service.markAllRead(user.userId) });
        }
    };
}
