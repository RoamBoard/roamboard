import type { RequestHandler } from "express";
import type { UsersRepository } from "./users.types.js";
import { createUsersRepository } from "./users.repository.js";
import { createUsersService } from "./users.service.js";
import { createUsersController } from "./users.controller.js";
import { createUsersRouter } from "./users.routes.js";
import type { ImagesRepository } from "../images/images.types.js";
import type { BoardRepository } from "../boards/boards.types.js";

export function createUsersModule(
    attachUser: RequestHandler,
    images: ImagesRepository,
    boards: BoardRepository,
    repository: UsersRepository = createUsersRepository()
) {
    const service = createUsersService(repository, images, boards);
    return { router: createUsersRouter(createUsersController(service), attachUser) };
}
