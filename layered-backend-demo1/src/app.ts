import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { env } from "./config/env.js";
import { createSearchModule } from "./features/search/search.module.js";
import type { SearchModule } from "./features/search/search.module.js";
import { createDestinationModule } from "./features/destinations/destination.module.js";
import { createProviderModule } from "./features/providers/provider.module.js";
import type { GooglePlaceReferenceRepository } from "./features/providers/provider.types.js";
import { createQuotaModule } from "./features/quotas/quota.module.js";
import type { QuotaRepository } from "./features/quotas/quota.types.js";
import { createTodoModule } from "./features/todos/todo.module.js";
import type { TodoRepository } from "./features/todos/todo.types.js";
import { createUserModule } from "./features/users/user.module.js";
import type { UserRepository } from "./features/users/user.types.js";
import type { BoardSearchIndexer } from "./features/users/user.types.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";

interface CreateAppOptions {
    todoRepository?: TodoRepository;
    searchModule?: SearchModule;
    quotaRepository?: QuotaRepository;
    googlePlaceReferenceRepository?: GooglePlaceReferenceRepository;
    userRepository?: UserRepository;
    boardSearchIndexer?: BoardSearchIndexer;
}

export function createApp({
    todoRepository,
    searchModule: providedSearchModule,
    quotaRepository,
    googlePlaceReferenceRepository,
    userRepository,
    boardSearchIndexer
}: CreateAppOptions = {}): Express {
    const app = express();
    const todoModule = createTodoModule({ repository: todoRepository });
    const searchModule = providedSearchModule ?? createSearchModule();
    const quotaModule = createQuotaModule(quotaRepository);
    const destinationModule = createDestinationModule(quotaModule.service);
    const providerModule = createProviderModule(quotaModule.service, googlePlaceReferenceRepository);
    const userModule = createUserModule({ repository: userRepository, searchIndexer: boardSearchIndexer });

    app.disable("x-powered-by");

    app.use(pinoHttp());
    app.use(helmet());
    app.use(cors({ origin: env.CLIENT_ORIGIN }));
    app.use(express.json({ limit: "100kb" }));

    app.get("/health", (_req, res) => {
        res.json({ status: "ok" });
    });
    app.get("/health/search", searchModule.controller.health);

    app.use("/api/v1/todos", todoModule.router);
    app.use("/api/v1/search", searchModule.router);
    app.use("/api/v1/destinations", destinationModule.router);
    app.use("/api/v1/providers", providerModule.router);
    app.use("/api/v1/quotas", quotaModule.router);
    app.use("/api/v1/users", userModule.userRouter);
    app.use("/api/v1/boards", userModule.boardRouter);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
