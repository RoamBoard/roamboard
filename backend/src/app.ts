import express, { type Express } from "express";
import helmet from "helmet";

import { checkDatabase } from "./db.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.get("/health/db", async (_request, response) => {
    try {
      await checkDatabase();
      response.status(200).json({ status: "ok" });
    } catch {
      response.status(503).json({ status: "unavailable" });
    }
  });

  return app;
}
