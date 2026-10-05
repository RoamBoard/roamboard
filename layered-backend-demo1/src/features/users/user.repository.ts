import { randomUUID } from "node:crypto";

import type {
  BoardSummary,
  CreateBoardInput,
  CreateDetailedBoardInput,
  CreateUserInput,
  DetailedBoard,
  MapDestination,
  ProfileStats,
  UpdateProfileInput,
  UserProfile,
  UserRepository,
} from "./user.types.js";
import { DEMO_USER_ID } from "./user.types.js";

const friendId = "00000000-0000-4000-8000-000000000002";

function now(): string {
  return new Date().toISOString();
}

function copyProfile(profile: UserProfile): UserProfile {
  return structuredClone(profile);
}

function copyBoard<T extends BoardSummary>(board: T): T {
  return structuredClone(board);
}

export function createUserRepository(): UserRepository {
  const users = new Map<string, UserProfile>([
    [DEMO_USER_ID, {
      id: DEMO_USER_ID,
      username: "roam_demo",
      displayName: "Roam Demo",
      description: "Testing the first Roamboard profile.",
      location: "Stockholm, Sweden",
      interests: ["food", "walking", "photography"],
      profilePicture: null,
      settings: { mapStyle: "streets", emailUpdates: false },
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
    }],
    [friendId, {
      id: friendId,
      username: "travel_friend",
      displayName: "Travel Friend",
      description: "A seeded friend for prototype statistics.",
      location: "Copenhagen, Denmark",
      interests: ["museums"],
      profilePicture: null,
      settings: {},
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
    }],
  ]);
  const boards = new Map<string, BoardSummary | DetailedBoard>();
  const visits = new Map<string, Map<string, string>>();
  const savedBoards = new Map<string, Set<string>>([[DEMO_USER_ID, new Set()]]);
  const friendships = new Set([`${DEMO_USER_ID}:${friendId}`]);
  const savedPlaceCounts = new Map([[DEMO_USER_ID, 1]]);

  const demoBoard: BoardSummary = {
    id: "10000000-0000-4000-8000-000000000001",
    ownerId: DEMO_USER_ID,
    title: "Copenhagen weekend",
    description: "Coffee, canals, and long walks.",
    visibility: "public",
    isCompleted: true,
    destinations: [{ id: "20000000-0000-4000-8000-000000000001", country: "Denmark", countryCode: "DK", city: "Copenhagen", latitude: 55.6761, longitude: 12.5683 }],
    createdAt: "2026-08-15T12:00:00.000Z",
    updatedAt: "2026-08-23T17:00:00.000Z",
  };
  const friendBoard: BoardSummary = {
    id: "10000000-0000-4000-8000-000000000003",
    ownerId: friendId,
    title: "Stockholm favourites",
    description: "A friend-owned public Board.",
    visibility: "public",
    isCompleted: true,
    destinations: [{ id: "20000000-0000-4000-8000-000000000003", country: "Sweden", countryCode: "SE", city: "Stockholm", latitude: 59.3293, longitude: 18.0686 }],
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-30T09:00:00.000Z",
  };
  boards.set(demoBoard.id, demoBoard);
  boards.set(friendBoard.id, friendBoard);
  visits.set(DEMO_USER_ID, new Map([[friendBoard.id, "2026-10-01T17:30:00.000Z"]]));
  savedBoards.get(DEMO_USER_ID)?.add(friendBoard.id);

  async function findUserById(id: string): Promise<UserProfile | null> {
    const profile = users.get(id);
    return profile ? copyProfile(profile) : null;
  }

  async function findUserByUsername(username: string): Promise<UserProfile | null> {
    const profile = Array.from(users.values()).find((value) => value.username.toLowerCase() === username.toLowerCase());
    return profile ? copyProfile(profile) : null;
  }

  async function createUser(input: CreateUserInput): Promise<UserProfile> {
    const timestamp = now();
    const profile: UserProfile = {
      id: randomUUID(), username: input.username, displayName: input.displayName,
      description: "", location: null, interests: [], profilePicture: null,
      settings: {}, createdAt: timestamp, updatedAt: timestamp,
    };
    users.set(profile.id, profile);
    return copyProfile(profile);
  }

  async function updateProfile(userId: string, changes: UpdateProfileInput): Promise<UserProfile | null> {
    const current = users.get(userId);
    if (!current) return null;
    const updated = {
      ...current,
      ...structuredClone(changes),
      settings: changes.settings ? { ...current.settings, ...structuredClone(changes.settings) } : current.settings,
      id: current.id,
      username: current.username,
      updatedAt: now(),
    };
    users.set(userId, updated);
    return copyProfile(updated);
  }

  async function setProfilePicture(userId: string, url: string, storageKey: string | null): Promise<UserProfile | null> {
    return updatePicture(userId, { url, storageKey });
  }

  async function deleteProfilePicture(userId: string): Promise<UserProfile | null> {
    return updatePicture(userId, null);
  }

  function updatePicture(userId: string, picture: UserProfile["profilePicture"]): UserProfile | null {
    const current = users.get(userId);
    if (!current) return null;
    const updated = { ...current, profilePicture: picture, updatedAt: now() };
    users.set(userId, updated);
    return copyProfile(updated);
  }

  async function getStats(userId: string): Promise<ProfileStats | null> {
    if (!users.has(userId)) return null;
    const ownBoards = Array.from(boards.values()).filter((board) => board.ownerId === userId);
    const countryCodes = new Set(ownBoards.filter((board) => board.isCompleted).flatMap((board) => board.destinations.map((destination) => destination.countryCode)));
    return {
      countriesVisited: countryCodes.size,
      boardsCreated: ownBoards.length,
      friends: Array.from(friendships).filter((pair) => pair.includes(userId)).length,
      placesSaved: savedPlaceCounts.get(userId) ?? 0,
      boardsSaved: savedBoards.get(userId)?.size ?? 0,
    };
  }

  async function findVisibleBoards(userId: string, limit: number, offset: number): Promise<BoardSummary[]> {
    const visible = await Promise.all(Array.from(boards.values()).map(async (board) => {
      const readable = board.ownerId === userId || ((board.status ?? "published") === "published" &&
        (board.visibility === "public" || (board.visibility === "friends" && await areFriends(userId, board.ownerId))));
      return readable ? board : null;
    }));
    return visible.filter((board): board is BoardSummary | DetailedBoard => board !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
      .slice(offset, offset + limit).map(copyBoard);
  }

  async function deleteBoard(userId: string, boardId: string): Promise<boolean> {
    if (boards.get(boardId)?.ownerId !== userId) return false;
    boards.delete(boardId);
    visits.forEach((items) => items.delete(boardId));
    savedBoards.forEach((items) => items.delete(boardId));
    return true;
  }

  async function findOwnBoards(userId: string, limit: number): Promise<BoardSummary[]> {
    return Array.from(boards.values()).filter((board) => board.ownerId === userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit).map(copyBoard);
  }

  async function findRecentBoards(userId: string, limit: number): Promise<BoardSummary[]> {
    const recent = Array.from(visits.get(userId)?.entries() ?? []).sort((a, b) => b[1].localeCompare(a[1])).slice(0, limit);
    return recent.flatMap(([boardId, lastVisitedAt]) => {
      const board = boards.get(boardId);
      return board ? [{ ...copyBoard(board), lastVisitedAt }] : [];
    });
  }

  async function findBoardById(boardId: string): Promise<BoardSummary | DetailedBoard | null> {
    const board = boards.get(boardId);
    return board ? copyBoard(board) : null;
  }

  async function areFriends(firstUserId: string, secondUserId: string): Promise<boolean> {
    return friendships.has(`${firstUserId}:${secondUserId}`) || friendships.has(`${secondUserId}:${firstUserId}`);
  }

  async function recordBoardVisit(userId: string, boardId: string): Promise<void> {
    const userVisits = visits.get(userId) ?? new Map<string, string>();
    userVisits.set(boardId, now());
    visits.set(userId, userVisits);
  }

  async function createBoard(userId: string, input: CreateBoardInput): Promise<BoardSummary> {
    const timestamp = now();
    const board: BoardSummary = {
      id: randomUUID(), ownerId: userId, title: input.title, description: input.description,
      visibility: input.visibility, isCompleted: input.isCompleted,
      destinations: input.destinations.map((destination) => ({ ...destination, id: randomUUID() })),
      createdAt: timestamp, updatedAt: timestamp,
    };
    boards.set(board.id, board);
    return copyBoard(board);
  }

  async function createDetailedBoard(userId: string, input: CreateDetailedBoardInput): Promise<DetailedBoard> {
    const timestamp = now();
    const destinations = input.days
      .flatMap((day) => day.pins)
      .flatMap((pin) => pin.location?.country && pin.location.countryCode && pin.location.city
        ? [{
            id: randomUUID(),
            country: pin.location.country,
            countryCode: pin.location.countryCode,
            city: pin.location.city,
            latitude: pin.location.latitude,
            longitude: pin.location.longitude,
          }]
        : [])
      .filter((destination, index, all) => all.findIndex((candidate) =>
        candidate.countryCode === destination.countryCode && candidate.city === destination.city
      ) === index);
    const board: DetailedBoard = {
      id: randomUUID(),
      ownerId: userId,
      title: input.title || "Untitled Board",
      description: input.description,
      visibility: input.visibility,
      isCompleted: false,
      status: input.status,
      tags: [...input.tags],
      vibes: [...input.vibes],
      highlights: [...input.highlights],
      destinations,
      days: structuredClone(input.days),
      images: structuredClone(input.images),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    boards.set(board.id, board);
    return structuredClone(board);
  }

  async function saveBoard(userId: string, boardId: string): Promise<void> {
    const current = savedBoards.get(userId) ?? new Set<string>();
    current.add(boardId);
    savedBoards.set(userId, current);
  }

  async function unsaveBoard(userId: string, boardId: string): Promise<boolean> {
    return savedBoards.get(userId)?.delete(boardId) ?? false;
  }

  async function findMapDestinations(userId: string): Promise<MapDestination[]> {
    return Array.from(boards.values()).filter((board) => board.ownerId === userId).flatMap((board) => board.destinations.map((destination) => ({ ...destination, boardId: board.id, boardTitle: board.title, isCompleted: board.isCompleted })));
  }

  return { findVisibleBoards, deleteBoard, findUserById, findUserByUsername, createUser, updateProfile, setProfilePicture, deleteProfilePicture, getStats, findOwnBoards, findRecentBoards, findBoardById, areFriends, recordBoardVisit, createBoard, createDetailedBoard, saveBoard, unsaveBoard, findMapDestinations };
}
