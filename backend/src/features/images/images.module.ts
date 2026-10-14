import type { RequestHandler, Router } from "express";

import type { BoardRepository } from "../boards/boards.types.js";
import { createCloudinaryProvider } from "./images.cloudinary.js";
import { createImagesController } from "./images.controller.js";
import { createImagesRepository } from "./images.repository.js";
import { createImagesRouter } from "./images.routes.js";
import { createImagesService } from "./images.service.js";
import type { ImageProvider, ImagesRepository, ImagesService } from "./images.types.js";

export interface ImagesModule {
    router: Router;
    service: ImagesService;
    repository: ImagesRepository;
    provider: ImageProvider;
}

export function createImagesModule(
    attachUser: RequestHandler,
    boards: BoardRepository,
    repository: ImagesRepository = createImagesRepository(),
    provider: ImageProvider = createCloudinaryProvider()
): ImagesModule {
    const service = createImagesService(repository, provider, boards);
    return {
        router: createImagesRouter(createImagesController(service), attachUser),
        service,
        repository,
        provider
    };
}
