import { Router } from "express";

import { validate } from "../../middleware/validate.js";
import { prototypeAuth } from "./user.auth.js";
import type { UserController } from "./user.controller.js";
import {
    boardByIdSchema,
    browseBoardsSchema,
    createBoardSchema,
    createDetailedBoardSchema,
    createUserSchema,
    listBoardsSchema,
    setProfilePictureSchema,
    updateProfileSchema
} from "./user.schemas.js";

export function createUserRouter(controller: UserController): Router {
    const router = Router();

    router.post("/", validate(createUserSchema), controller.createUser);
    router.use(prototypeAuth);
    router.get("/me", controller.getProfile);
    router.patch("/me", validate(updateProfileSchema), controller.updateProfile);
    router.put("/me/profile-picture", validate(setProfilePictureSchema), controller.setProfilePicture);
    router.delete("/me/profile-picture", controller.deleteProfilePicture);
    router.get("/me/stats", controller.getStats);
    router.get("/me/boards", validate(listBoardsSchema), controller.listOwnBoards);
    router.post("/me/boards", validate(createBoardSchema), controller.createBoard);
    router.get("/me/recent-boards", validate(listBoardsSchema), controller.listRecentBoards);
    router.put("/me/saved-boards/:boardId", validate(boardByIdSchema), controller.saveBoard);
    router.delete("/me/saved-boards/:boardId", validate(boardByIdSchema), controller.unsaveBoard);
    router.get("/me/map-destinations", controller.getMapDestinations);

    return router;
}

export function createBoardRouter(controller: UserController): Router {
    const router = Router();
    router.use(prototypeAuth);
    router.get("/", validate(browseBoardsSchema), controller.listBoards);
    router.delete("/:boardId", validate(boardByIdSchema), controller.deleteBoard);
    router.post("/", validate(createDetailedBoardSchema), controller.createDetailedBoard);
    router.get("/:boardId", validate(boardByIdSchema), controller.getBoard);
    return router;
}
