import { saveImageEditSchema } from "./images.schemas.js";
import { Router, type RequestHandler } from "express";

import { requireFrontendOrigin } from "../../middleware/require-origin.js";
import { requireSessionUser } from "../../middleware/session-user.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import {
    completeUploadSchema,
    imageIdParamsSchema,
    imageVariantQuerySchema,
    uploadIntentSchema
} from "../boards/boards.schemas.js";
import type { ImagesController } from "./images.controller.js";

export function createImagesRouter(controller: ImagesController, attachUser: RequestHandler): Router {
    const router = Router();
    router.get(
        "/images/:imageId/presentation",
        attachUser,
        requireSessionUser,
        validateParams(imageIdParamsSchema),
        controller.readPresentation
    );
    router.put(
        "/images/:imageId/presentation",
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        validateParams(imageIdParamsSchema),
        validateBody(saveImageEditSchema),
        controller.savePresentation
    );
    router.post(
        "/images/upload-intents",
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        validateBody(uploadIntentSchema),
        controller.createIntent
    );
    router.post(
        "/images/complete",
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        validateBody(completeUploadSchema),
        controller.complete
    );
    router.get(
        "/images/:imageId/content",
        validateParams(imageIdParamsSchema),
        validateQuery(imageVariantQuerySchema),
        attachUser,
        controller.content
    );
    return router;
}
