import type { RequestHandler } from "express";

import type { AppUser } from "../auth/auth.types.js";
import type { BoardReplace, BoardWrite } from "./boards.schemas.js";
import type { BoardsService } from "./boards.types.js";

interface BoardController {
    listAccessible: RequestHandler;
    listTags: RequestHandler;
    listCategories: RequestHandler;
    create: RequestHandler;
    replace: RequestHandler;
    read: RequestHandler;
    listOwned: RequestHandler;
    delete: RequestHandler;
}

function userId(locals: Record<string, unknown>): string {
    return (locals.user as AppUser).userId;
}

export function createBoardsController(service: BoardsService): BoardController {
    return {
        listAccessible: async (_request, response) => {
            const { page, limit } = response.locals.query as { page: number; limit: number };
            const result = await service.listAccessible(userId(response.locals), page, limit);
            response.json({ data: result.items, meta: { page, limit, hasMore: result.hasMore } });
        },
        listTags: async (_request, response) => {
            response.json({ data: await service.listTags() });
        },
        listCategories: async (_request, response) => {
            response.json({ data: await service.listCategories() });
        },
        create: async (request, response) => {
            const board = await service.create(userId(response.locals), request.body as BoardWrite);
            response.location(`/api/v1/boards/${board.boardId}`).status(201).json({ data: board });
        },
        replace: async (request, response) => {
            const { boardId } = response.locals.params as { boardId: number };
            const { revision, ...document } = request.body as BoardReplace;
            const board = await service.replace(userId(response.locals), boardId, revision, document);
            response.json({ data: board });
        },
        read: async (_request, response) => {
            const { boardId } = response.locals.params as { boardId: number };
            const current = response.locals.user as AppUser | null;
            response.json({ data: await service.read(boardId, current?.userId ?? null) });
        },
        listOwned: async (_request, response) => {
            const { scope, page, limit } = response.locals.query as {
                scope: "drafts" | "published";
                page: number;
                limit: number;
            };
            const result =
                scope === "drafts"
                    ? await service.listDrafts(userId(response.locals), page, limit)
                    : await service.listPublished(userId(response.locals), page, limit);
            response.json({ data: result.items, meta: { page, limit, hasMore: result.hasMore } });
        },
        delete: async (_request, response) => {
            const { boardId } = response.locals.params as { boardId: number };
            await service.delete(boardId, userId(response.locals));
            response.status(204).send();
        }
    };
}
