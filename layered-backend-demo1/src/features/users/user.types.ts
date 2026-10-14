export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

export type BoardVisibility = "private" | "friends" | "public";
export type BoardStatus = "draft" | "published";
export type PinCategory = "landmark" | "culture" | "museum" | "restaurant" | "cafe" | "bar" | "shopping" | "park" | "nature" | "hike" | "beach" | "neighborhood" | "city" | "address" | "stay" | "transit" | "event" | "activity" | "other";

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
  status?: BoardStatus;
  tags?: string[];
  vibes?: string[];
  highlights?: string[];
}

export interface BoardPinLocation {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  mapboxId: string | null;
}

export interface BoardPinInput {
  id: string;
  order: number;
  time: string;
  title: string;
  description: string;
  category: PinCategory;
  source: "manual" | "mapbox" | "geoapify" | "photo";
  location: BoardPinLocation | null;
}

export interface BoardDayInput {
  id: string;
  dayNumber: number;
  date: string | null;
  pins: BoardPinInput[];
}

export interface BoardImageInput {
  id: string;
  pinId: string | null;
  publicId: string;
  source: "upload" | "unsplash";
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  capturedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  order: number;
  credit: string | null;
  creditUrl: string | null;
  sourceUrl: string | null;
}

export interface CreateDetailedBoardInput {
  title: string;
  description: string;
  status: BoardStatus;
  visibility: BoardVisibility;
  tags: string[];
  vibes: string[];
  highlights: string[];
  days: BoardDayInput[];
  images: BoardImageInput[];
}

export interface DetailedBoard extends BoardSummary {
  status: BoardStatus;
  tags: string[];
  vibes: string[];
  highlights: string[];
  days: BoardDayInput[];
  images: BoardImageInput[];
}

export interface BoardSearchDocument {
  id: string;
  entityType: "itinerary";
  title: string;
  titleSuggest: string;
  description: string;
  city: string;
  country: string;
  tags: string[];
  categories: string[];
  location: { lat: number; lon: number };
  popularity: number;
  isPublic: boolean;
  updatedAt: string;
}

export interface BoardSearchIndexer {
  index(document: BoardSearchDocument): Promise<void>;
  remove?(boardId: string): Promise<void>;
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
  findVisibleBoards(userId: string, limit: number, offset: number): Promise<BoardSummary[]>;
  deleteBoard(userId: string, boardId: string): Promise<boolean>;
  findOwnBoards(userId: string, limit: number): Promise<BoardSummary[]>;
  findRecentBoards(userId: string, limit: number): Promise<BoardSummary[]>;
  findBoardById(boardId: string): Promise<BoardSummary | DetailedBoard | null>;
  areFriends(firstUserId: string, secondUserId: string): Promise<boolean>;
  recordBoardVisit(userId: string, boardId: string): Promise<void>;
  createBoard(userId: string, input: CreateBoardInput): Promise<BoardSummary>;
  createDetailedBoard(userId: string, input: CreateDetailedBoardInput): Promise<DetailedBoard>;
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
  listBoards(userId: string, page: number, limit: number): Promise<{ boards: BoardSummary[]; hasMore: boolean }>;
  deleteBoard(userId: string, boardId: string): Promise<void>;
  getOwnBoards(userId: string, limit: number): Promise<BoardSummary[]>;
  getRecentBoards(userId: string, limit: number): Promise<BoardSummary[]>;
  getBoard(userId: string, boardId: string): Promise<BoardSummary | DetailedBoard>;
  createBoard(userId: string, input: CreateBoardInput): Promise<BoardSummary>;
  createDetailedBoard(userId: string, input: CreateDetailedBoardInput): Promise<DetailedBoard>;
  saveBoard(userId: string, boardId: string): Promise<void>;
  unsaveBoard(userId: string, boardId: string): Promise<void>;
  getMapDestinations(userId: string): Promise<MapDestination[]>;
}
