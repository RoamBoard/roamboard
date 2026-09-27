import { AppError } from "../shared/app-error.js";

export function notFoundHandler(req, res, next) {
  next(
    new AppError(
      404,
      `Route ${req.method} ${req.originalUrl} not found`,
    ),
  );
}

