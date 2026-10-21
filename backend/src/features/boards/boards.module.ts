import type { RequestHandler, Router } from "express";
import type { ImageCleanup } from "../images/images.cleanup.js";

import { createBoardsController } from "./boards.controller.js";
import { createBoardsRepository } from "./boards.repository.js";
import { createBoardsRouter } from "./boards.routes.js";
import { createBoardsService } from "./boards.service.js";
import type { BoardRepository, BoardsService, CopyBoardImage, FillerProvider } from "./boards.types.js";

export interface BoardsModule {
    router: Router;
    service: BoardsService;
    repository: BoardRepository;
}

export function createBoardsModule(
    attachUser: RequestHandler,
    repository: BoardRepository = createBoardsRepository(),
    copyImage?: CopyBoardImage,
    cleanupImages?: ImageCleanup,
    fillerProvider?: FillerProvider
): BoardsModule {
    const service = createBoardsService(repository, copyImage, cleanupImages, fillerProvider);
    const controller = createBoardsController(service);
    return { router: createBoardsRouter(controller, attachUser), service, repository };
}
