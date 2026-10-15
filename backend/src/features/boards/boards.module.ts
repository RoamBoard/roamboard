import type { RequestHandler, Router } from "express";

import { createBoardsController } from "./boards.controller.js";
import { createBoardsRepository } from "./boards.repository.js";
import { createBoardsRouter } from "./boards.routes.js";
import { createBoardsService } from "./boards.service.js";
import type { BoardRepository, BoardsService } from "./boards.types.js";

export interface BoardsModule {
    router: Router;
    service: BoardsService;
    repository: BoardRepository;
}

export function createBoardsModule(
    attachUser: RequestHandler,
    repository: BoardRepository = createBoardsRepository(),
    refreshSearch?: (boardId: number) => Promise<void>
): BoardsModule {
    const service = createBoardsService(repository, refreshSearch);
    const controller = createBoardsController(service);
    return { router: createBoardsRouter(controller, attachUser), service, repository };
}
