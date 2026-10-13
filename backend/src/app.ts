import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";

import { checkDatabase } from "./db.js";
import {
    createAuthModule,
    type AuthModuleOptions
} from "./features/auth/auth.module.js";
import { errorHandler } from "./middleware/error-handler.js";

export function createApp(options: AuthModuleOptions = {}): Express {
    const app = express();

    app.disable("x-powered-by");
    app.use(helmet());
    app.use(
        cors({
            origin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
            credentials: true
        })
    );
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

    app.use("/api/v1/auth", createAuthModule(options).router);
    app.use(errorHandler);

    return app;
}
