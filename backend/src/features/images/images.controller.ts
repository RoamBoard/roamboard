import type { RequestHandler } from "express";

import type { AppUser } from "../auth/auth.types.js";
import type { UploadIntentWrite } from "../boards/boards.schemas.js";
import type { ImagesService } from "./images.types.js";

export interface ImagesController {
    createIntent: RequestHandler;
    complete: RequestHandler;
    content: RequestHandler;
    readPresentation: RequestHandler;
    savePresentation: RequestHandler;
}

export function createImagesController(service: ImagesService): ImagesController {
    return {
        readPresentation: async (_req, res) =>
            res.json({ data: await service.readPresentation(res.locals.user.userId, res.locals.params.imageId) }),
        savePresentation: async (req, res) =>
            res.json({
                data: await service.savePresentation(
                    res.locals.user.userId,
                    res.locals.params.imageId,
                    req.body.revision,
                    req.body.edit
                )
            }),
        createIntent: async (request, response) => {
            const user = response.locals.user as AppUser;
            response.json({ data: await service.createIntent(user.userId, request.body as UploadIntentWrite) });
        },
        complete: async (request, response) => {
            const user = response.locals.user as AppUser;
            const { uploadId } = request.body as { uploadId: string };
            response.status(201).json({ data: await service.complete(user.userId, uploadId) });
        },
        content: async (_request, response, next) => {
            const { imageId } = response.locals.params as { imageId: number };
            const { variant, boardId, profileHandle } = response.locals.query as {
                variant: "display" | "thumbnail" | "original";
                boardId?: number;
                profileHandle?: string;
            };
            const user = response.locals.user as AppUser | null;
            const { stream, contentType } = await service.openImage(
                imageId,
                variant,
                user?.userId ?? null,
                boardId,
                profileHandle
            );
            // Do not cache protected content across later changes to Board access.
            response.set({
                "Content-Type": contentType,
                "Cache-Control": "private, no-store",
                "Cross-Origin-Resource-Policy": "cross-origin",
                "X-Content-Type-Options": "nosniff",
                Vary: "Cookie"
            });
            stream.on("error", next);
            stream.pipe(response);
        }
    };
}
