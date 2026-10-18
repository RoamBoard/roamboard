import type { RequestHandler } from "express";
import type { SavedPlacesRepository } from "./saved-places.types.js";
import { createSavedPlacesRepository } from "./saved-places.repository.js";
import { createSavedPlacesService } from "./saved-places.service.js";
import { createSavedPlacesController } from "./saved-places.controller.js";
import { createSavedPlacesRouter } from "./saved-places.routes.js";

// Use the shared database in production and an injected repository in API tests.
export function createSavedPlacesModule(
    attachUser: RequestHandler,
    repository: SavedPlacesRepository = createSavedPlacesRepository()
) {
    return {
        router: createSavedPlacesRouter(createSavedPlacesController(createSavedPlacesService(repository)), attachUser)
    };
}
