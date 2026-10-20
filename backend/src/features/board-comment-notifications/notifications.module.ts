import type { RequestHandler } from "express";

import type { BoardRepository } from "../boards/boards.types.js";
import { createNotificationsController } from "./notifications.controller.js";
import { createNotificationsRepository } from "./notifications.repository.js";
import { createNotificationsRouter } from "./notifications.routes.js";
import { createNotificationsService } from "./notifications.service.js";
import type { NotificationsRepository } from "./notifications.types.js";

export function createNotificationsModule(
    attachUser: RequestHandler,
    boards: BoardRepository,
    repository: NotificationsRepository = createNotificationsRepository()
) {
    const service = createNotificationsService(boards, repository);
    return {
        router: createNotificationsRouter(createNotificationsController(service), attachUser),
        service,
        repository
    };
}
