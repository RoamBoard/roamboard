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
            const [user, boards, userStats, photosUploaded] = await Promise.all([
                read(userId),
                repository.listBoards(userId, false, true),
                repository.stats(userId),
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
            let friendshipStatus: PublicProfileView["friendshipStatus"] = undefined;
            if (viewerId && viewerId !== userId) {
                const friendship = await repository.getFriendship(viewerId, userId);
                if (!friendship) {
                    friendshipStatus = "none";
                } else if (friendship.status === "accepted") {
                    friendshipStatus = "accepted";
                } else if (friendship.requesterUserId === viewerId) {
                    friendshipStatus = "pending_sent";
                } else {
                    friendshipStatus = "pending_received";
                }
            } else if (!viewerId) {
                friendshipStatus = "none";
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
                              url: user.profilePicture.url.includes("profileHandle=")
                                  ? user.profilePicture.url
                                  : `${user.profilePicture.url}${
                                        user.profilePicture.url.includes("?") ? "&" : "?"
                                    }profileHandle=${encodeURIComponent(user.username)}`
                          }
                        : null
                },
                isOwner: viewerId === userId,
                friendshipStatus,
                stats: {
                    friends: userStats.friends ?? 0,
                    activitiesSaved: userStats.activitiesSaved ?? 0,
                    boardsSaved: userStats.boardsSaved ?? 0,
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
        unsaveBoard: (userId: string, boardId: number) => repository.unsaveBoard(userId, boardId),
        async sendFriendRequest(requesterId: string, handle: string) {
            const recipientId = await repository.findIdByHandle(handle);
            if (!recipientId) throw new AppError(404, "User not found", "NOT_FOUND");
            if (requesterId === recipientId)
                throw new AppError(400, "Cannot add yourself as a friend", "INVALID_REQUEST");
            const existing = await repository.getFriendship(requesterId, recipientId);
            if (existing) {
                if (existing.status === "accepted") throw new AppError(409, "Already friends", "ALREADY_FRIENDS");
                if (existing.requesterUserId === requesterId)
                    throw new AppError(409, "Friend request already sent", "REQUEST_ALREADY_SENT");
                await repository.acceptFriendRequest(requesterId, existing.friendshipId);
                return { requestId: existing.friendshipId, status: "accepted" as const };
            }
            try {
                const requestId = await repository.sendFriendRequest(requesterId, recipientId);
                return { requestId, status: "pending_sent" as const };
            } catch (error: unknown) {
                const pgError = error as { code?: string; message?: string };
                if (pgError.code === "23505" || pgError.message?.includes("uq_friendship_pair")) {
                    const winning = await repository.getFriendship(requesterId, recipientId);
                    if (winning) {
                        if (winning.status === "accepted") {
                            return { requestId: winning.friendshipId, status: "accepted" as const };
                        }
                        if (winning.requesterUserId === recipientId) {
                            await repository.acceptFriendRequest(requesterId, winning.friendshipId);
                            return { requestId: winning.friendshipId, status: "accepted" as const };
                        }
                        return { requestId: winning.friendshipId, status: "pending_sent" as const };
                    }
                }
                throw error;
            }
        },
        listFriendRequests: (userId: string) => repository.listIncomingFriendRequests(userId),
        async acceptFriendRequest(userId: string, requestId: number) {
            const updated = await repository.acceptFriendRequest(userId, requestId);
            if (!updated) throw new AppError(404, "Friend request not found", "NOT_FOUND");
            return { requestId, status: "accepted" as const };
        },
        async rejectFriendRequest(userId: string, requestId: number) {
            const deleted = await repository.rejectFriendRequest(userId, requestId);
            if (!deleted) throw new AppError(404, "Friend request not found", "NOT_FOUND");
        },
        listFriends: (userId: string) => repository.listFriends(userId),
        searchUsers: (userId: string, query: string, limit: number) => repository.searchUsers(userId, query, limit),
        listFriendsBoards: (userId: string, limit: number) => repository.listFriendsBoards(userId, limit),
        listFriendsActivity: (userId: string, limit: number) => repository.listFriendsActivity(userId, limit),
        async removeFriend(userId: string, targetUserId: string) {
            const deleted = await repository.removeFriend(userId, targetUserId);
            if (!deleted) throw new AppError(404, "Friendship not found", "NOT_FOUND");
        },
        async removeFriendByHandle(userId: string, handle: string) {
            const deleted = await repository.removeFriendByHandle(userId, handle);
            if (!deleted) throw new AppError(404, "Friendship not found", "NOT_FOUND");
        }
    };
}
