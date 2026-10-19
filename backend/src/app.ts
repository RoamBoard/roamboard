import { createSmartCreateModule } from "./features/smart-create/smart-create.module.js";
import type { SmartCreateResolver } from "./features/smart-create/smart-create.service.js";
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";

import { checkDatabase } from "./db.js";
import { createAuthModule, type AuthModuleOptions } from "./features/auth/auth.module.js";
import { createBoardsModule } from "./features/boards/boards.module.js";
import { createBoardsRepository } from "./features/boards/boards.repository.js";
import type { BoardRepository } from "./features/boards/boards.types.js";
import { createImagesModule } from "./features/images/images.module.js";
import type { ImageProvider, ImagesRepository } from "./features/images/images.types.js";
import { errorHandler } from "./middleware/error-handler.js";
import { attachSessionUser } from "./middleware/session-user.js";
import { createProviderModule } from "./features/providers/provider.module.js";
import { createDestinationModule } from "./features/destinations/destination.module.js";
import { createQuotaService, type QuotaService } from "./features/quotas/quota.service.js";
import { createQuotaPolicies } from "./features/quotas/quota.policies.js";
import { createPostgresQuotaRepository } from "./features/quotas/quota.postgres-repository.js";
import { createUsersModule } from "./features/users/users.module.js";
import type { UsersRepository } from "./features/users/users.types.js";
import { createSearchModule } from "./features/search/search.module.js";
import type { SearchProvider, SearchRepository } from "./features/search/search.types.js";
import { createLibraryModule } from "./features/image-library/image-library.module.js";
import type { LibraryProvider, LibraryRepository } from "./features/image-library/image-library.types.js";
import { createSavedPlacesModule } from "./features/saved-places/saved-places.module.js";
import type { SavedPlacesRepository } from "./features/saved-places/saved-places.types.js";

export interface AppOptions extends AuthModuleOptions {
    smartCreateResolver?: SmartCreateResolver;
    libraryRepository?: LibraryRepository;
    libraryProvider?: LibraryProvider;
    boardRepository?: BoardRepository;
    imagesRepository?: ImagesRepository;
    imageProvider?: ImageProvider;
    quotaService?: QuotaService;
    usersRepository?: UsersRepository;
    searchRepository?: SearchRepository;
    searchProvider?: SearchProvider;
    savedPlacesRepository?: SavedPlacesRepository;
}

export function createApp(options: AppOptions = {}): Express {
    const app = express();

    app.disable("x-powered-by");
    app.use(helmet());
    app.use(
        cors({
            origin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
            credentials: true,
            exposedHeaders: ["Retry-After"]
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

    const quota = options.quotaService ?? createQuotaService(createPostgresQuotaRepository(), createQuotaPolicies());
    const auth = createAuthModule({ ...options, quotaService: quota });
    const attachUser = attachSessionUser(auth.service);
    const providers = createProviderModule(quota, attachUser);
    const destinations = createDestinationModule(quota);
    const search = createSearchModule(options.searchRepository, options.searchProvider);
    const boardRepository = options.boardRepository ?? createBoardsRepository();
    const images = createImagesModule(
        attachUser,
        boardRepository,
        options.imagesRepository,
        options.imageProvider,
        quota
    );
    const boards = createBoardsModule(attachUser, boardRepository, images.service.copyForBoard);
    const users = createUsersModule(attachUser, images.repository, boards.repository, options.usersRepository);
    app.use("/api/v1/auth", auth.router);
    app.use(
        "/api/v1/image-library",
        createLibraryModule(attachUser, quota, options.libraryRepository, options.libraryProvider).router
    );
    app.use("/api/v1/providers", providers.router);
    app.use("/api/v1/destinations", destinations.router);
    app.use("/api/v1/users", users.router);
    app.use("/api/v1", users.publicRouter);
    app.use("/api/v1/search", search.router);
    app.use("/api/v1/saved-places", createSavedPlacesModule(attachUser, options.savedPlacesRepository).router);
    app.use("/api/v1", boards.router);
    app.use("/api/v1", images.router);
    app.use(
        "/api/v1",
        createSmartCreateModule(attachUser, images.repository, quota, options.smartCreateResolver, images.provider)
            .router
    );
    app.use((_request, response) => {
        response.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
    });
    app.use(errorHandler);

    return app;
}
