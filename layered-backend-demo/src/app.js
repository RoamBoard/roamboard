import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { env } from "./config/env.js";
import { createTodoModule } from "./features/todos/todo.module.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";

// Creates and configures the Express application.
export function createApp({ todoRepository } = {}) {
  const app = express();
  // Wires the todo's feature architecture / layer into a single module.
  // This is done for each  feature.
  const todoModule = createTodoModule({ repository: todoRepository });


  app.disable("x-powered-by");

  // Registers global middleware.
  app.use(pinoHttp());
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // When this url hits this endpoint, forward the request to the router of the todo module to determine its exact nature (GET, POST,..)
  // Examples
  // GET    http://localhost:3000/api/v1/todos
  // POST   http://localhost:3000/api/v1/todos
  // GET    http://localhost:3000/api/v1/todos/abc-123
  // The router removes the prefix and sees:
  // /
  // /
  // /abc-123
  app.use("/api/v1/todos", todoModule.router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

