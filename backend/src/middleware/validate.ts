import type { RequestHandler } from "express";
import type { ZodType } from "zod";

import { AppError } from "../shared/app-error.js";

export function validateBody(schema: ZodType): RequestHandler {
    return (request, _response, next) => {
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            next(new AppError(400, "Invalid request", "INVALID_REQUEST"));
            return;
        }

        request.body = parsed.data;
        next();
    };
}

export function validateParams(schema: ZodType): RequestHandler {
    return (request, response, next) => {
        const parsed = schema.safeParse(request.params);
        if (!parsed.success) {
            next(new AppError(400, "Invalid request", "INVALID_REQUEST"));
            return;
        }
        response.locals.params = parsed.data;
        next();
    };
}

export function validateQuery(schema: ZodType): RequestHandler {
    return (request, response, next) => {
        const parsed = schema.safeParse(request.query);
        if (!parsed.success) {
            next(new AppError(400, "Invalid request", "INVALID_REQUEST"));
            return;
        }
        response.locals.query = parsed.data;
        next();
    };
}
