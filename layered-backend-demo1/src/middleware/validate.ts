import type { RequestHandler } from "express";
import type { ZodType } from "zod";

import { AppError } from "../shared/app-error.js";

export function validate<T>(schema: ZodType<T>): RequestHandler {
  return function validationMiddleware(req, _res, next) {
    const result = schema.safeParse({
      body: req.body ?? {},
      params: req.params ?? {},
      query: req.query ?? {},
    });

    if (!result.success) {
      return next(
        new AppError(400, "Invalid request", result.error.flatten()),
      );
    }

    req.validated = result.data;
    next();
  };
}
