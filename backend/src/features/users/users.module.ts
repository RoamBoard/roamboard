import type { RequestHandler } from "express";
import type { ImageCleanup } from "../images/images.cleanup.js";
import type { UsersRepository } from "./users.types.js";
import { createUsersRepository } from "./users.repository.js";
import { createUsersService } from "./users.service.js";
import { createUsersController } from "./users.controller.js";
import { createUsersRouter, createProfileExtrasRouter } from "./users.routes.js";
import type { ImagesRepository } from "../images/images.types.js";
import type { BoardRepository } from "../boards/boards.types.js";

export function createUsersModule(
    attachUser: RequestHandler,
    images: ImagesRepository,
    boards: BoardRepository,
    repository: UsersRepository = createUsersRepository(),
    cleanupImages?: ImageCleanup
) {
    const service = createUsersService(repository, images, boards, cleanupImages);
    const controller = createUsersController(service);
    return {
        router: createUsersRouter(controller, attachUser),
        publicRouter: createProfileExtrasRouter(controller, attachUser)
    };
}
