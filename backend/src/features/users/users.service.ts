import { AppError } from "../../shared/app-error.js";
import type { UsersRepository, ProfileChanges } from "./users.types.js";
import type { ImagesRepository } from "../images/images.types.js";
import type { BoardRepository } from "../boards/boards.types.js";
import { canReadBoard } from "../boards/boards.types.js";
import { spokenLanguages } from "../../shared/spoken-languages.js";
import { continentForCountry } from "../../shared/continents.js";
import type { PublicProfileView } from "./users.types.js";

export function createUsersService(
    repository: UsersRepository,
    images: Pick<ImagesRepository, "findImage">,
    boards: Pick<BoardRepository, "listTags" | "getAccess">
) {
    const read = async (userId: string) => {
        const profile = await repository.read(userId);
        if (!profile) throw new AppError(404, "Profile not found", "NOT_FOUND");
        return profile;
    };
    return {
        read,
        async publicProfile(handle: string, viewerId: string | null): Promise<PublicProfileView> {
            const userId = await repository.findIdByHandle(handle);
            if (!userId) throw new AppError(404, "Profile not found", "NOT_FOUND");
            const [user, boards, photosUploaded] = await Promise.all([
                read(userId),
                repository.listBoards(userId, false, true),
                repository.countPublicPhotos(userId)
            ]);
            const destinations = boards
                .filter((board) => board.isCompleted)
                .flatMap((board) =>
                    board.destinations.map((place) => ({
                        ...place,
                        id: `${board.id}:${place.id}`,
                        boardId: Number(board.id),
                        boardTitle: board.title,
                        isCompleted: true
                    }))
                );
            const countries = new Set<string>();
            const cities = new Set<string>();
            const continents = new Set<string>();
            for (const place of destinations) {
                if (!place.countryCode) continue;
                countries.add(place.countryCode);
                if (place.city?.trim()) cities.add(`${place.countryCode}:${place.city.trim().toLocaleLowerCase("en")}`);
                const continent = continentForCountry(place.countryCode);
                if (continent) continents.add(continent);
            }
            return {
                profile: {
                    username: user.username,
                    displayName: user.displayName,
                    description: user.description,
                    location: user.location,
                    occupation: user.occupation,
                    languages: user.languages,
                    interests: user.interests,
                    profilePicture: user.profilePicture
                        ? {
                              ...user.profilePicture,
                              url: `${user.profilePicture.url}&profileHandle=${encodeURIComponent(user.username)}`
                          }
                        : null
                },
                isOwner: viewerId === userId,
                stats: {
                    countriesVisited: countries.size,
                    citiesExplored: cities.size,
                    continentsCovered: continents.size,
                    photosUploaded,
                    boardsCreated: boards.length
                },
                boards: boards.map((board) => ({
                    boardId: Number(board.id),
                    title: board.title,
                    coverImageUrl: board.coverImageUrl,
                    updatedAt: board.updatedAt
                })),
                destinations
            };
        },
        languages: () => spokenLanguages,
        async update(userId: string, input: ProfileChanges) {
            if (new Set(input.interests).size !== input.interests.length)
                throw new AppError(400, "Choose distinct interests", "INVALID_REQUEST");
            if (
                new Set(input.languages).size !== input.languages.length ||
                input.languages.some((name) => !spokenLanguages.includes(name))
            )
                throw new AppError(400, "Choose languages from the list", "INVALID_REQUEST");
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
        async mapDestinations(userId: string, visitedOnly = false) {
            const boards = await repository.listBoards(userId, false);
            return boards
                .filter((board) => board.status === "published" && (!visitedOnly || board.isCompleted))
                .flatMap((board) =>
                    board.destinations.map((place) => ({
                        ...place,
                        id: `${board.id}:${place.id}`,
                        boardId: Number(board.id),
                        boardTitle: board.title,
                        isCompleted: board.isCompleted
                    }))
                );
        },
        listSavedBoards: (userId: string, page: number, limit: number) =>
            repository.listSavedBoards(userId, page, limit),
        async saveBoard(userId: string, boardId: number) {
            const access = await boards.getAccess(boardId, userId);
            if (!access || !canReadBoard(access, userId) || access.status !== "published")
                throw new AppError(404, "Board not found", "NOT_FOUND");
            if (access.ownerUserId === userId)
                throw new AppError(403, "You cannot save your own Board", "CANNOT_SAVE_OWN_BOARD");
            return repository.saveBoard(userId, boardId);
        },
        unsaveBoard: (userId: string, boardId: number) => repository.unsaveBoard(userId, boardId)
    };
}
