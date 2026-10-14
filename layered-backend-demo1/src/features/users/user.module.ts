import type { Router } from "express";

import { createUserController, type UserController } from "./user.controller.js";
import { createUserRepository } from "./user.repository.js";
import { createBoardRouter, createUserRouter } from "./user.routes.js";
import { createUserService } from "./user.service.js";
import type { BoardSearchIndexer, UserRepository, UserService } from "./user.types.js";

export interface UserModule {
    userRouter: Router;
    boardRouter: Router;
    controller: UserController;
    service: UserService;
    repository: UserRepository;
}

interface CreateUserModuleOptions {
    repository?: UserRepository;
    searchIndexer?: BoardSearchIndexer;
}

export function createUserModule({
    repository = createUserRepository(),
    searchIndexer
}: CreateUserModuleOptions = {}): UserModule {
    const service = createUserService(repository, searchIndexer);
    const controller = createUserController(service);
    return {
        userRouter: createUserRouter(controller),
        boardRouter: createBoardRouter(controller),
        controller,
        service,
        repository
    };
}
