import type { ErrorRequestHandler } from "express";

import { AppError } from "../shared/app-error.js";

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
    if (response.headersSent) {
        next(error);
        return;
    }

    if (error instanceof AppError) {
        response.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
    }

    const type = typeof error === "object" && error !== null && "type" in error ? error.type : null;
    if (type === "entity.too.large" || type === "entity.parse.failed") {
        response.status(type === "entity.too.large" ? 413 : 400).json({
            error: {
                code: "INVALID_REQUEST",
                message: type === "entity.too.large" ? "Request is too large" : "Invalid JSON body"
            }
        });
        return;
    }

    response.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" }
    });
};
