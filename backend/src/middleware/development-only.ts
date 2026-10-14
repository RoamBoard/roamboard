import type { RequestHandler } from "express";
import { AppError } from "../shared/app-error.js";

export const developmentOnly: RequestHandler = (_request, _response, next) => {
    next(process.env.NODE_ENV === "development" ? undefined : new AppError(404, "Not found", "NOT_FOUND"));
};
