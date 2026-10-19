import type { RequestHandler } from "express";

import type { BoardRepository } from "../boards/boards.types.js";
import { createCommentsController } from "./board-comments.controller.js";
import { createCommentsRepository } from "./board-comments.repository.js";
import { createCommentsRouter } from "./board-comments.routes.js";
import { createCommentsService } from "./board-comments.service.js";
import type { CommentsRepository } from "./board-comments.types.js";

export function createCommentsModule(
    attachUser: RequestHandler,
    boards: BoardRepository,
    repository: CommentsRepository = createCommentsRepository()
) {
    const service = createCommentsService(boards, repository);
    return { router: createCommentsRouter(createCommentsController(service), attachUser), service, repository };
}
