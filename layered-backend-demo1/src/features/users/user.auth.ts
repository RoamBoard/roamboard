import type { RequestHandler } from "express";
import { z } from "zod";

import { AppError } from "../../shared/app-error.js";
import { DEMO_USER_ID } from "./user.types.js";

const userIdSchema = z.string().uuid();

export const prototypeAuth: RequestHandler = (req, _res, next) => {
    const header = req.header("x-demo-user-id");
    const result = userIdSchema.safeParse(header ?? DEMO_USER_ID);
    if (!result.success) {
        return next(new AppError(401, "Invalid prototype user", undefined, "INVALID_PROTOTYPE_USER"));
    }
    req.prototypeUserId = result.data;
    next();
};

export function getPrototypeUserId(userId: string | undefined): string {
    if (!userId) throw new AppError(401, "Prototype user is required", undefined, "PROTOTYPE_USER_REQUIRED");
    return userId;
}
