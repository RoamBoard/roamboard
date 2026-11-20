import type { RequestHandler, Router } from "express";

import { createAccountDeletionController } from "./account-deletion.controller.js";
import { createAccountDeletionRepository, type AccountDeletionRepository } from "./account-deletion.repository.js";
import { createAccountDeletionRouter } from "./account-deletion.routes.js";
import { createAccountDeletionService, type AccountDeletionService } from "./account-deletion.service.js";

export function createAccountDeletionModule(
    attachUser: RequestHandler,
    repository: AccountDeletionRepository = createAccountDeletionRepository()
): { router: Router; service: AccountDeletionService; repository: AccountDeletionRepository } {
    const service = createAccountDeletionService(repository);
    const controller = createAccountDeletionController(service);
    return { router: createAccountDeletionRouter(attachUser, controller), service, repository };
}
