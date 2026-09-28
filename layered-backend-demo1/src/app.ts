import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { env } from "./config/env.js";
import { createTodoModule } from "./features/todos/todo.module.js";
import type { TodoRepository } from "./features/todos/todo.types.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";

interface CreateAppOptions {
  todoRepository?: TodoRepository;
}

export function createApp({ todoRepository }: CreateAppOptions = {}): Express {
  const app = express();
  const todoModule = createTodoModule({ repository: todoRepository });

  app.disable("x-powered-by");

  app.use(pinoHttp());
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/v1/todos", todoModule.router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
