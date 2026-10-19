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

export type FriendshipStatus = "none" | "pending_sent" | "pending_received" | "accepted";

export interface FriendRequest {
    requestId: number;
    requester: {
        userId: string;
        username: string;
        displayName: string;
        profilePictureUrl: string | null;
    };
}

export interface FriendshipRecord {
    friendshipId: number;
    status: "pending" | "accepted";
    requesterUserId: string;
    recipientUserId: string;
}

export interface PublicProfileView {
    profile: PublicProfile;
    isOwner: boolean;
    friendshipStatus?: FriendshipStatus;
    stats: ProfileStats;
    boards: Array<{ boardId: number; title: string; coverImageUrl: string | null; updatedAt: string }>;
    destinations: MapDestination[];
}

export interface ProfileStats {
    countriesVisited: number;
    citiesExplored: number;
    continentsCovered: number;
    photosUploaded: number;
    activitiesDone: number;
    boardsCreated: number;
    friends: number;
    activitiesSaved: number;
    boardsSaved: number;
}

export interface MapDestination {
    id: string;
    boardId?: number;
    boardTitle?: string;
    coverImageUrl?: string | null;
    collection?: "published" | "saved";
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
    activityCount?: number;
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

export interface FriendUser {
    userId: string;
    username: string;
    displayName: string;
    profilePictureUrl: string | null;
    bio: string | null;
    location: string | null;
}

export interface UserSearchResult extends FriendUser {
    friendshipStatus: "none" | "pending_sent" | "pending_received" | "accepted";
    requestId?: number;
}

export interface FriendBoardSummary {
    boardId: number;
    title: string;
    description: string | null;
    owner: {
        userId: string;
        username: string;
        displayName: string;
        profilePictureUrl: string | null;
    };
    coverImageUrl: string | null;
    createdAt: string;
}

export interface FriendActivityItem {
    activityType: "published_board";
    boardId: number;
    title: string;
    owner: {
        userId: string;
        username: string;
        displayName: string;
        profilePictureUrl: string | null;
    };
    coverImageUrl: string | null;
    timestamp: string;
}

export interface UsersRepository {
    read(userId: string): Promise<UserProfile | null>;
    findIdByHandle(handle: string): Promise<string | null>;
    update(userId: string, input: ProfileChanges): Promise<void>;
    setPicture(userId: string, imageId: number | null): Promise<void>;
    listBoards(
        userId: string,
        recent: boolean,
        publicOnly?: boolean,
        viewerId?: string | null,
        saved?: boolean
    ): Promise<ProfileBoard[]>;
    countPublicPhotos(userId: string, viewerId?: string | null): Promise<number>;
    stats(userId: string): Promise<Record<string, number>>;
    listSavedBoards(userId: string, page: number, limit: number): Promise<{ items: SavedBoard[]; hasMore: boolean }>;
    saveBoard(userId: string, boardId: number): Promise<boolean>;
    unsaveBoard(userId: string, boardId: number): Promise<void>;
    getFriendship(userId1: string, userId2: string): Promise<FriendshipRecord | null>;
    sendFriendRequest(requesterId: string, recipientId: string): Promise<number>;
    listIncomingFriendRequests(userId: string): Promise<FriendRequest[]>;
    acceptFriendRequest(recipientId: string, requestId: number): Promise<boolean>;
    rejectFriendRequest(userId: string, requestId: number): Promise<boolean>;
    listFriends(userId: string): Promise<FriendUser[]>;
    searchUsers(userId: string, query: string, limit: number): Promise<UserSearchResult[]>;
    listFriendsBoards(userId: string, limit: number): Promise<FriendBoardSummary[]>;
    listFriendsActivity(userId: string, limit: number): Promise<FriendActivityItem[]>;
    removeFriend(userId: string, targetUserId: string): Promise<boolean>;
    removeFriendByHandle(userId: string, handle: string): Promise<boolean>;
}
