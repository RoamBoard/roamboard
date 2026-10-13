import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";

import { checkDatabase } from "./db.js";
import {
    createAuthModule,
    type AuthModuleOptions
} from "./features/auth/auth.module.js";
import { createBoardsModule } from "./features/boards/boards.module.js";
import type { BoardRepository } from "./features/boards/boards.types.js";
import { createImagesModule } from "./features/images/images.module.js";
import type { ImageProvider, ImagesRepository } from "./features/images/images.types.js";
import { errorHandler } from "./middleware/error-handler.js";
import { attachSessionUser } from "./middleware/session-user.js";

export interface AppOptions extends AuthModuleOptions {
    boardRepository?: BoardRepository;
    imagesRepository?: ImagesRepository;
    imageProvider?: ImageProvider;
}

export function createApp(options: AppOptions = {}): Express {
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

    const auth = createAuthModule(options);
    const attachUser = attachSessionUser(auth.service);
    const boards = createBoardsModule(attachUser, options.boardRepository);
    const images = createImagesModule(attachUser, boards.repository,
        options.imagesRepository, options.imageProvider);
    app.use("/api/v1/auth", auth.router);
    app.use("/api/v1", boards.router);
    app.use("/api/v1", images.router);
    app.use(errorHandler);

    return app;
}
