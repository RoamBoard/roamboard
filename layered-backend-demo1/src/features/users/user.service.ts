import debug from "debug";

import { AppError } from "../../shared/app-error.js";
import type {
    BoardSummary,
    BoardSearchDocument,
    BoardSearchIndexer,
    CreateBoardInput,
    CreateDetailedBoardInput,
    DetailedBoard,
    CreateUserInput,
    MapDestination,
    ProfileStats,
    UpdateProfileInput,
    UserProfile,
    UserRepository,
    UserService
} from "./user.types.js";

const noopSearchIndexer: BoardSearchIndexer = { index: async () => undefined };
const log = debug("roamboard:boards");

export function createUserService(
    repository: UserRepository,
    searchIndexer: BoardSearchIndexer = noopSearchIndexer
): UserService {
    async function requireUser(userId: string): Promise<UserProfile> {
        const user = await repository.findUserById(userId);
        if (!user) throw new AppError(401, "Prototype user was not found", undefined, "PROTOTYPE_USER_NOT_FOUND");
        return user;
    }

    async function createUser(input: CreateUserInput): Promise<UserProfile> {
        if (await repository.findUserByUsername(input.username)) {
            throw new AppError(409, "Username is already taken", undefined, "USERNAME_TAKEN");
        }
        return repository.createUser(input);
    }

    async function getCurrentProfile(userId: string): Promise<UserProfile> {
        return requireUser(userId);
    }

    async function updateCurrentProfile(userId: string, changes: UpdateProfileInput): Promise<UserProfile> {
        await requireUser(userId);
        const profile = await repository.updateProfile(userId, changes);
        if (!profile) throw new AppError(404, "Profile not found", undefined, "PROFILE_NOT_FOUND");
        return profile;
    }

    async function setProfilePicture(userId: string, url: string, storageKey: string | null): Promise<UserProfile> {
        await requireUser(userId);
        const profile = await repository.setProfilePicture(userId, url, storageKey);
        if (!profile) throw new AppError(404, "Profile not found", undefined, "PROFILE_NOT_FOUND");
        return profile;
    }

    async function deleteProfilePicture(userId: string): Promise<UserProfile> {
        await requireUser(userId);
        const profile = await repository.deleteProfilePicture(userId);
        if (!profile) throw new AppError(404, "Profile not found", undefined, "PROFILE_NOT_FOUND");
        return profile;
    }

    async function getStats(userId: string): Promise<ProfileStats> {
        await requireUser(userId);
        const stats = await repository.getStats(userId);
        if (!stats) throw new AppError(404, "Profile not found", undefined, "PROFILE_NOT_FOUND");
        return stats;
    }

    async function listBoards(
        userId: string,
        page: number,
        limit: number
    ): Promise<{ boards: BoardSummary[]; hasMore: boolean }> {
        await requireUser(userId);
        const boards = await repository.findVisibleBoards(userId, limit + 1, (page - 1) * limit);
        return { boards: boards.slice(0, limit), hasMore: boards.length > limit };
    }

    async function deleteBoard(userId: string, boardId: string): Promise<void> {
        await requireUser(userId);
        const board = await repository.findBoardById(boardId);
        if (!board || !(await canReadBoard(userId, board)))
            throw new AppError(404, "Board not found", undefined, "BOARD_NOT_FOUND");
        if (board.ownerId !== userId)
            throw new AppError(403, "Only the Board owner can delete it.", undefined, "BOARD_FORBIDDEN");
        if (!(await repository.deleteBoard(userId, boardId)))
            throw new AppError(404, "Board not found", undefined, "BOARD_NOT_FOUND");
        try {
            await searchIndexer.remove?.(boardId);
        } catch (error) {
            log(
                "Board %s deleted; search removal will be reconciled on reindex: %s",
                boardId,
                error instanceof Error ? error.message : "unknown error"
            );
        }
    }

    async function getOwnBoards(userId: string, limit: number): Promise<BoardSummary[]> {
        await requireUser(userId);
        return repository.findOwnBoards(userId, limit);
    }

    async function getRecentBoards(userId: string, limit: number): Promise<BoardSummary[]> {
        await requireUser(userId);
        return repository.findRecentBoards(userId, limit);
    }

    async function canReadBoard(userId: string, board: BoardSummary): Promise<boolean> {
        if (board.ownerId === userId) return true;
        if (board.status === "draft") return false;
        if (board.visibility === "public") return true;
        return board.visibility === "friends" && repository.areFriends(userId, board.ownerId);
    }

    async function getBoard(userId: string, boardId: string): Promise<BoardSummary | DetailedBoard> {
        await requireUser(userId);
        const board = await repository.findBoardById(boardId);
        if (!board || !(await canReadBoard(userId, board))) {
            throw new AppError(404, "Board not found", undefined, "BOARD_NOT_FOUND");
        }
        await repository.recordBoardVisit(userId, boardId);
        return board;
    }

    async function createBoard(userId: string, input: CreateBoardInput): Promise<BoardSummary> {
        await requireUser(userId);
        return repository.createBoard(userId, input);
    }

    function toSearchDocument(board: DetailedBoard): BoardSearchDocument | null {
        if (board.status !== "published" || board.visibility !== "public") return null;
        const locatedPin = board.days.flatMap((day) => day.pins).find((pin) => pin.location)?.location;
        if (!locatedPin) return null;
        return {
            id: board.id,
            entityType: "itinerary",
            title: board.title,
            titleSuggest: board.title,
            description: board.description,
            city: locatedPin.city ?? locatedPin.name,
            country: locatedPin.country ?? "",
            tags: board.tags,
            categories: [
                ...new Set([...board.vibes, ...board.days.flatMap((day) => day.pins.map((pin) => pin.category))])
            ],
            location: { lat: locatedPin.latitude, lon: locatedPin.longitude },
            popularity: 0,
            isPublic: true,
            updatedAt: board.updatedAt
        };
    }

    async function createDetailedBoard(userId: string, input: CreateDetailedBoardInput): Promise<DetailedBoard> {
        await requireUser(userId);
        const board = await repository.createDetailedBoard(userId, input);
        const searchDocument = toSearchDocument(board);
        if (searchDocument) {
            try {
                await searchIndexer.index(searchDocument);
            } catch (error) {
                log(
                    "Board %s was saved but live search indexing failed: %s",
                    board.id,
                    error instanceof Error ? error.message : "unknown error"
                );
            }
        }
        return board;
    }

    async function saveBoard(userId: string, boardId: string): Promise<void> {
        const board = await getBoard(userId, boardId);
        await repository.saveBoard(userId, board.id);
    }

    async function unsaveBoard(userId: string, boardId: string): Promise<void> {
        await requireUser(userId);
        await repository.unsaveBoard(userId, boardId);
    }

    async function getMapDestinations(userId: string): Promise<MapDestination[]> {
        await requireUser(userId);
        return repository.findMapDestinations(userId);
    }

    return {
        listBoards,
        deleteBoard,
        createUser,
        getCurrentProfile,
        updateCurrentProfile,
        setProfilePicture,
        deleteProfilePicture,
        getStats,
        getOwnBoards,
        getRecentBoards,
        getBoard,
        createBoard,
        createDetailedBoard,
        saveBoard,
        unsaveBoard,
        getMapDestinations
    };
}
