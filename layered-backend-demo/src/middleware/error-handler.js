import { AppError } from "../shared/app-error.js";

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  req.log?.error({ err: error }, "Request failed");

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: {
        message: error.message,
        details: error.details,
      },
    });
  }

  return res.status(500).json({
    error: {
      message: "Internal server error",
    },
  });
}

