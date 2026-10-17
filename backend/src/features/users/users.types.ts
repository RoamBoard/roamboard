export interface UserProfile {
    id: string;
    username: string;
    displayName: string;
    description: string;
    location: string | null;
    occupation: string | null;
    languages: string[];
    interests: string[];
    profilePicture: { imageId: number; url: string; storageKey: null } | null;
    defaultBoardVisibility: "collaborators" | "friends" | "public";
    revision: number;
    createdAt: string;
    updatedAt: string;
}

export type PublicProfile = Pick<
    UserProfile,
    | "username"
    | "displayName"
    | "description"
    | "location"
    | "occupation"
    | "languages"
    | "interests"
    | "profilePicture"
>;

export interface PublicProfileView {
    profile: PublicProfile;
    isOwner: boolean;
    stats: Pick<
        ProfileStats,
        "countriesVisited" | "citiesExplored" | "continentsCovered" | "photosUploaded" | "boardsCreated"
    >;
    boards: Array<{ boardId: number; title: string; coverImageUrl: string | null; updatedAt: string }>;
    destinations: MapDestination[];
}

export interface ProfileStats {
    countriesVisited: number;
    citiesExplored: number;
    continentsCovered: number;
    photosUploaded: number;
    boardsCreated: number;
    friends: number;
    activitiesSaved: number;
    boardsSaved: number;
}

export interface MapDestination {
    id: string;
    boardId?: number;
    boardTitle?: string;
    country: string;
    countryCode: string | null;
    city: string | null;
    latitude: number;
    longitude: number;
    isCompleted?: boolean;
}

export interface ProfileBoard {
    id: string;
    ownerId: string;
    title: string;
    description: string;
    visibility: "collaborators" | "friends" | "public";
    status: "draft" | "published";
    isCompleted: boolean;
    destinations: MapDestination[];
    createdAt: string;
    updatedAt: string;
    coverImageUrl: string | null;
}

export type ProfileChanges = Pick<
    UserProfile,
    | "username"
    | "displayName"
    | "description"
    | "location"
    | "occupation"
    | "languages"
    | "interests"
    | "defaultBoardVisibility"
    | "revision"
>;
export interface SavedBoard {
    boardId: number;
    title: string;
    description: string;
    owner: { id: string; username: string; displayName: string };
    coverImageUrl: string | null;
    savedAt: string;
}
export interface UsersRepository {
    read(userId: string): Promise<UserProfile | null>;
    findIdByHandle(handle: string): Promise<string | null>;
    update(userId: string, input: ProfileChanges): Promise<void>;
    setPicture(userId: string, imageId: number | null): Promise<void>;
    listBoards(userId: string, recent: boolean, publicOnly?: boolean): Promise<ProfileBoard[]>;
    countPublicPhotos(userId: string): Promise<number>;
    stats(userId: string): Promise<Record<string, number>>;
    listSavedBoards(userId: string, page: number, limit: number): Promise<{ items: SavedBoard[]; hasMore: boolean }>;
    saveBoard(userId: string, boardId: number): Promise<boolean>;
    unsaveBoard(userId: string, boardId: number): Promise<void>;
}
