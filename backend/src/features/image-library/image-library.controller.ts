import type { RequestHandler } from "express";
import type { createLibraryService } from "./image-library.service.js";

export function createLibraryController(service: ReturnType<typeof createLibraryService>) {
    const list: RequestHandler = async (_req, res) => {
        res.set("Cache-Control", "no-store").json({ data: await service.list(res.locals.query.keys) });
    };
    const get: RequestHandler = async (_req, res) => {
        res.set("Cache-Control", "no-store").json({ data: await service.get(res.locals.params.assetKey) });
    };
    const upload: RequestHandler = async (_req, res) => {
        res.status(201).json({ data: await service.upload(res.locals.file.buffer, res.locals.query) });
    };
    const unsplash: RequestHandler = async (req, res) => {
        res.status(201).json({ data: await service.unsplash(req.body) });
    };
    return { list, get, upload, unsplash };
}
