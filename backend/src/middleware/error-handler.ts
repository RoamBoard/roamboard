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

    response.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" }
    });
};
