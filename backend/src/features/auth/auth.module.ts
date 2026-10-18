import type { Router } from "express";
import type { QuotaService } from "../quotas/quota.service.js";

import { createAuthController, type AuthController } from "./auth.controller.js";
import { createGoogleVerifier } from "./auth.google.js";
import { createAuthRepository } from "./auth.repository.js";
import { createAuthRouter } from "./auth.routes.js";
import { createImagesRepository } from "../images/images.repository.js";
import type { ImagesRepository } from "../images/images.types.js";
import { createCloudinaryProvider } from "../images/images.cloudinary.js";
import { createGooglePhotoImporter } from "./auth.photo.js";
import { createAuthService } from "./auth.service.js";
import type { AuthRepository, AuthService, GoogleVerifier, GooglePhotoImporter } from "./auth.types.js";

export interface AuthModule {
    router: Router;
    controller: AuthController;
    service: AuthService;
    repository: AuthRepository;
}

export interface AuthModuleOptions {
    quotaService?: QuotaService;
    imagesRepository?: ImagesRepository;
    repository?: AuthRepository;
    googleVerifier?: GoogleVerifier;
    googlePhotoImporter?: GooglePhotoImporter;
}

export function createAuthModule(options: AuthModuleOptions = {}): AuthModule {
    const repository = options.repository ?? createAuthRepository();
    const verifier = options.googleVerifier ?? createGoogleVerifier();
    const service = createAuthService(
        repository,
        verifier,
        options.googlePhotoImporter ??
            createGooglePhotoImporter(
                createCloudinaryProvider(options.quotaService),
                options.imagesRepository ?? createImagesRepository()
            )
    );
    const controller = createAuthController(service);
    const router = createAuthRouter(controller);
    return { router, controller, service, repository };
}
