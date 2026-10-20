import type { RequestHandler } from "express";
import type { BoardRepository } from "../boards/boards.types.js";
import { createDiscoveryController } from "./discovery.controller.js";
import { createDiscoveryRepository } from "./discovery.repository.js";
import { createDiscoveryRouter } from "./discovery.routes.js";
import { createDiscoveryService } from "./discovery.service.js";
import type { DiscoveryRepository } from "./discovery.types.js";
export function createDiscoveryModule(
    attachUser: RequestHandler,
    boards: BoardRepository,
    repository: DiscoveryRepository = createDiscoveryRepository()
) {
    const service = createDiscoveryService(repository, boards);
    return {
        repository,
        service,
        router: createDiscoveryRouter(createDiscoveryController(service, repository), attachUser)
    };
}
