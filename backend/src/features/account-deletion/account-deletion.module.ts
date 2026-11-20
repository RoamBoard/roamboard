import type { RequestHandler, Router } from "express";

import { createAccountDeletionController } from "./account-deletion.controller.js";
import { createAccountDeletionRepository, type AccountDeletionRepository } from "./account-deletion.repository.js";
import { createAccountDeletionRouter } from "./account-deletion.routes.js";

export function createAccountDeletionModule(
    attachUser: RequestHandler,
    repository: AccountDeletionRepository = createAccountDeletionRepository()
): { router: Router; repository: AccountDeletionRepository } {
    const controller = createAccountDeletionController(repository);
    return { router: createAccountDeletionRouter(attachUser, controller), repository };
}
