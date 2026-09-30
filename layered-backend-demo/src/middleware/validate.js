import { AppError } from "../shared/app-error.js";

export function validate(schema) {
  return function validationMiddleware(req, res, next) {
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

