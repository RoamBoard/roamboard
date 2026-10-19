import type { RequestHandler } from "express";

import type { AppUser } from "../auth/auth.types.js";
import type { createCommentsService } from "./board-comments.service.js";

type CommentsService = ReturnType<typeof createCommentsService>;

export function createCommentsController(service: CommentsService): {
    list: RequestHandler;
    create: RequestHandler;
    edit: RequestHandler;
    delete: RequestHandler;
} {
    return {
        list: async (_request, response) => {
            const { boardId } = response.locals.params as { boardId: number };
            const { cursor } = response.locals.query as { cursor?: string };
            const user = response.locals.user as AppUser | null;
            response.set("Cache-Control", "no-store").json(await service.list(boardId, user?.userId ?? null, cursor));
        },
        create: async (request, response) => {
            const { boardId } = response.locals.params as { boardId: number };
            const user = response.locals.user as AppUser;
            const { body } = request.body as { body: string };
            const comment = await service.create(boardId, user.userId, body);
            response
                .set("Cache-Control", "no-store")
                .location(`/api/v1/boards/${boardId}/comments/${comment.commentId}`)
                .status(201)
                .json({ data: comment });
        },
        edit: async (request, response) => {
            const { boardId, commentId } = response.locals.params as { boardId: number; commentId: number };
            const user = response.locals.user as AppUser;
            const { body, revision } = request.body as { body: string; revision: number };
            response
                .set("Cache-Control", "no-store")
                .json({ data: await service.edit(boardId, commentId, user.userId, body, revision) });
        },
        delete: async (_request, response) => {
            const { boardId, commentId } = response.locals.params as { boardId: number; commentId: number };
            const user = response.locals.user as AppUser;
            await service.delete(boardId, commentId, user.userId);
            response.set("Cache-Control", "no-store").status(204).send();
        }
    };
}
