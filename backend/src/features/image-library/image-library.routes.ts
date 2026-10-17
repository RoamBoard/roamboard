import express, { Router, type RequestHandler } from "express";
import { developmentOnly } from "../../middleware/development-only.js";
import { requireSessionUser } from "../../middleware/session-user.js";
import { requireFrontendOrigin } from "../../middleware/require-origin.js";
import { validateBody, validateQuery, validateParams } from "../../middleware/validate.js";
import { parseUpload } from "../providers/provider.upload.js";
import {
    libraryUnsplashSchema,
    libraryWriteSchema,
    libraryReadSchema,
    libraryKeySchema
} from "./image-library.schemas.js";
import type { createLibraryController } from "./image-library.controller.js";

export function createLibraryRouter(
    controller: ReturnType<typeof createLibraryController>,
    attachUser: RequestHandler
) {
    const router = Router();
    // This catalog contains public editorial images only, never protected user media.
    router.get("/", validateQuery(libraryReadSchema), controller.list);
    router.get("/:assetKey", validateParams(libraryKeySchema), controller.get);
    router.post(
        "/upload",
        developmentOnly,
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        validateQuery(libraryWriteSchema),
        express.raw({ type: "multipart/form-data", limit: "11mb" }),
        parseUpload,
        controller.upload
    );
    router.post(
        "/unsplash",
        developmentOnly,
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        validateBody(libraryUnsplashSchema),
        controller.unsplash
    );
    return router;
}
