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
