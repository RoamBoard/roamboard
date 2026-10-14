import type { Router } from "express";

import { createAuthController, type AuthController } from "./auth.controller.js";
import { createGoogleVerifier } from "./auth.google.js";
import { createAuthRepository } from "./auth.repository.js";
import { createAuthRouter } from "./auth.routes.js";
import { createAuthService } from "./auth.service.js";
import type { AuthRepository, AuthService, GoogleVerifier } from "./auth.types.js";

export interface AuthModule {
    router: Router;
    controller: AuthController;
    service: AuthService;
    repository: AuthRepository;
}

export interface AuthModuleOptions {
    repository?: AuthRepository;
    googleVerifier?: GoogleVerifier;
}

export function createAuthModule(options: AuthModuleOptions = {}): AuthModule {
    const repository = options.repository ?? createAuthRepository();
    const verifier = options.googleVerifier ?? createGoogleVerifier();
    const service = createAuthService(repository, verifier);
    const controller = createAuthController(service);
    const router = createAuthRouter(controller);
    return { router, controller, service, repository };
}
