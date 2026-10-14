import { AppError } from "../../shared/app-error.js";
import type { UsersRepository, ProfileChanges } from "./users.types.js";
import type { ImagesRepository } from "../images/images.types.js";
import type { BoardRepository } from "../boards/boards.types.js";

export function createUsersService(
    repository: UsersRepository,
    images: Pick<ImagesRepository, "findImage">,
    boards: Pick<BoardRepository, "listTags">
) {
    const read = async (userId: string) => {
        const profile = await repository.read(userId);
        if (!profile) throw new AppError(404, "Profile not found", "NOT_FOUND");
        return profile;
    };
    return {
        read,
        async update(userId: string, input: ProfileChanges) {
            if (new Set(input.interests).size !== input.interests.length)
                throw new AppError(400, "Choose distinct interests", "INVALID_REQUEST");
            const tags = await boards.listTags();
            if (input.interests.some((name) => !tags.some((tag) => tag.name === name)))
                throw new AppError(400, "Choose interests from the tag list", "INVALID_REQUEST");
            await repository.update(userId, input);
            return read(userId);
        },
        async setPicture(userId: string, imageId: number | null) {
            if (imageId !== null) {
                const image = await images.findImage(imageId);
                if (!image || image.uploaderUserId !== userId)
                    throw new AppError(404, "Owned image not found", "NOT_FOUND");
            }
            await repository.setPicture(userId, imageId);
            return read(userId);
        },
        listBoards: (userId: string, recent = false) => repository.listBoards(userId, recent),
        stats: (userId: string) => repository.stats(userId),
        async mapDestinations(userId: string) {
            const boards = await repository.listBoards(userId, false);
            return boards
                .filter((board) => board.status === "published")
                .flatMap((board) =>
                    board.destinations.map((place) => ({
                        ...place,
                        id: `${board.id}:${place.id}`,
                        boardId: board.id,
                        boardTitle: board.title,
                        isCompleted: board.isCompleted
                    }))
                );
        }
    };
}
