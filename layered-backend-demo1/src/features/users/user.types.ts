export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

export type BoardVisibility = "private" | "friends" | "public";

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  description: string;
  location: string | null;
  interests: string[];
  profilePicture: { url: string; storageKey: string | null } | null;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileStats {
  countriesVisited: number;
  boardsCreated: number;
  friends: number;
  placesSaved: number;
  boardsSaved: number;
}

export interface BoardDestination {
  id: string;
  country: string;
  countryCode: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface BoardSummary {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  visibility: BoardVisibility;
  isCompleted: boolean;
  destinations: BoardDestination[];
  createdAt: string;
  updatedAt: string;
  lastVisitedAt?: string;
}

export interface MapDestination extends BoardDestination {
  boardId: string;
  boardTitle: string;
  isCompleted: boolean;
}

export interface CreateUserInput {
  username: string;
  displayName: string;
}

export interface UpdateProfileInput {
  displayName?: string;
  description?: string;
  location?: string | null;
  interests?: string[];
  settings?: Record<string, unknown>;
}

export interface CreateBoardInput {
  title: string;
  description: string;
  visibility: BoardVisibility;
  isCompleted: boolean;
  destinations: Array<Omit<BoardDestination, "id">>;
}

export interface UserRepository {
  findUserById(id: string): Promise<UserProfile | null>;
  findUserByUsername(username: string): Promise<UserProfile | null>;
  createUser(input: CreateUserInput): Promise<UserProfile>;
  updateProfile(userId: string, changes: UpdateProfileInput): Promise<UserProfile | null>;
  setProfilePicture(userId: string, url: string, storageKey: string | null): Promise<UserProfile | null>;
  deleteProfilePicture(userId: string): Promise<UserProfile | null>;
  getStats(userId: string): Promise<ProfileStats | null>;
  findOwnBoards(userId: string, limit: number): Promise<BoardSummary[]>;
  findRecentBoards(userId: string, limit: number): Promise<BoardSummary[]>;
  findBoardById(boardId: string): Promise<BoardSummary | null>;
  areFriends(firstUserId: string, secondUserId: string): Promise<boolean>;
  recordBoardVisit(userId: string, boardId: string): Promise<void>;
  createBoard(userId: string, input: CreateBoardInput): Promise<BoardSummary>;
  saveBoard(userId: string, boardId: string): Promise<void>;
  unsaveBoard(userId: string, boardId: string): Promise<boolean>;
  findMapDestinations(userId: string): Promise<MapDestination[]>;
}

export interface UserService {
  createUser(input: CreateUserInput): Promise<UserProfile>;
  getCurrentProfile(userId: string): Promise<UserProfile>;
  updateCurrentProfile(userId: string, changes: UpdateProfileInput): Promise<UserProfile>;
  setProfilePicture(userId: string, url: string, storageKey: string | null): Promise<UserProfile>;
  deleteProfilePicture(userId: string): Promise<UserProfile>;
  getStats(userId: string): Promise<ProfileStats>;
  getOwnBoards(userId: string, limit: number): Promise<BoardSummary[]>;
  getRecentBoards(userId: string, limit: number): Promise<BoardSummary[]>;
  getBoard(userId: string, boardId: string): Promise<BoardSummary>;
  createBoard(userId: string, input: CreateBoardInput): Promise<BoardSummary>;
  saveBoard(userId: string, boardId: string): Promise<void>;
  unsaveBoard(userId: string, boardId: string): Promise<void>;
  getMapDestinations(userId: string): Promise<MapDestination[]>;
}
