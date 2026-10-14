import type { RequestHandler } from "express";

import { AppError } from "../shared/app-error.js";

export const requireFrontendOrigin: RequestHandler = (request, _response, next) => {
    const expected = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";
    if (request.get("Origin") !== expected) {
        next(new AppError(403, "Origin not allowed", "ORIGIN_NOT_ALLOWED"));
        return;
    }
    next();
};
