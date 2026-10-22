import { Router, type RequestHandler } from "express";

import { requireFrontendOrigin } from "../../middleware/require-origin.js";
import { requireSessionUser } from "../../middleware/session-user.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { createNotificationsController } from "./notifications.controller.js";
import {
    emptyNotificationBodySchema,
    emptyNotificationQuerySchema,
    notificationParamsSchema,
    notificationQuerySchema,
    subscriptionBodySchema,
    subscriptionParamsSchema
} from "./notifications.schemas.js";

export function createNotificationsRouter(
    controller: ReturnType<typeof createNotificationsController>,
    attachUser: RequestHandler
): Router {
    const router = Router();
    router.use((_request, response, next) => {
        response.set("Cache-Control", "no-store");
        next();
    });
    router.get(
        "/boards/:boardId/comment-subscription",
        validateParams(subscriptionParamsSchema),
        attachUser,
        requireSessionUser,
        controller.subscription
    );
    router.put(
        "/boards/:boardId/comment-subscription",
        validateParams(subscriptionParamsSchema),
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        validateBody(subscriptionBodySchema),
        controller.setSubscription
    );
    router.get(
        "/users/me/comment-notifications",
        validateQuery(notificationQuerySchema),
        attachUser,
        requireSessionUser,
        controller.list
    );
    router.post(
        "/users/me/comment-notifications/read-all",
        validateQuery(emptyNotificationQuerySchema),
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        validateBody(emptyNotificationBodySchema),
        controller.markAllRead
    );
    router.post(
        "/users/me/comment-notifications/:notificationId/read",
        validateParams(notificationParamsSchema),
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        controller.markRead
    );
    return router;
}
