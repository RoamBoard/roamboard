import { AppError } from "../../shared/app-error.js";
import type {
  BoardSummary,
  CreateBoardInput,
  CreateUserInput,
  MapDestination,
  ProfileStats,
  UpdateProfileInput,
  UserProfile,
  UserRepository,
  UserService,
} from "./user.types.js";

export function createUserService(repository: UserRepository): UserService {
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

  async function getOwnBoards(userId: string, limit: number): Promise<BoardSummary[]> {
    await requireUser(userId);
    return repository.findOwnBoards(userId, limit);
  }

  async function getRecentBoards(userId: string, limit: number): Promise<BoardSummary[]> {
    await requireUser(userId);
    return repository.findRecentBoards(userId, limit);
  }

  async function canReadBoard(userId: string, board: BoardSummary): Promise<boolean> {
    if (board.ownerId === userId || board.visibility === "public") return true;
    return board.visibility === "friends" && repository.areFriends(userId, board.ownerId);
  }

  async function getBoard(userId: string, boardId: string): Promise<BoardSummary> {
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

  return { createUser, getCurrentProfile, updateCurrentProfile, setProfilePicture, deleteProfilePicture, getStats, getOwnBoards, getRecentBoards, getBoard, createBoard, saveBoard, unsaveBoard, getMapDestinations };
}
