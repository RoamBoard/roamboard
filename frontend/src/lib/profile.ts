import { saveBoardDocument } from "@/lib/board-creator-api";
import { captureAccountUpdate } from "@/lib/auth";

export type UserProfile = {
    id: string;
    username: string;
    displayName: string;
    description: string;
    location: string | null;
    occupation: string | null;
    languages: string[];
    interests: string[];
    profilePicture: { imageId: number; url: string; storageKey: string | null } | null;
    defaultBoardVisibility: "collaborators" | "friends" | "public";
    revision: number;
    createdAt: string;
    updatedAt: string;
};

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

export type FriendRequest = {
    requestId: number;
    requester: {
        userId: string;
        username: string;
        displayName: string;
        profilePictureUrl: string | null;
    };
};

export type PublicProfileView = {
    profile: PublicProfile;
    isOwner: boolean;
    friendshipStatus?: FriendshipStatus;
    stats: ProfileStats;
    boards: PublishedBoardSummary[];
    savedBoards?: SavedBoardSummary[];
    destinations: MapDestination[];
};

export type ProfileStats = {
    countriesVisited: number;
    citiesExplored: number;
    continentsCovered: number;
    photosUploaded: number;
    activitiesDone: number;
    boardsCreated: number;
    friends: number;
    activitiesSaved: number;
    savesReceived?: number;
    boardsSaved: number;
};

export type PublishedBoardSummary = {
    boardId: number;
    title: string;
    coverImageUrl: string | null;
    updatedAt: string;
    // Present on the owned scope list; the public handle response omits it.
    visibility?: "collaborators" | "friends" | "public";
};

export type SavedBoardSummary = {
    boardId: number;
    title: string;
    description: string;
    owner: { id: string; username: string; displayName: string };
    coverImageUrl: string | null;
    savedAt: string;
};

export type ProfileBoard = {
    id: string;
    ownerId: string;
    title: string;
    description: string;
    visibility: "collaborators" | "friends" | "public";
    isCompleted: boolean;
    destinations: MapDestination[];
    createdAt: string;
    updatedAt: string;
    lastVisitedAt?: string;
};

export type MapDestination = {
    id: string;
    boardId?: number;
    boardTitle?: string;
    coverImageUrl?: string | null;
    collection?: "published" | "saved";
    country: string;
    countryCode: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    isCompleted?: boolean;
};

export const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ProfileApiError extends Error {
    constructor(
        public status: number,
        public code: string,
        message: string
    ) {
        super(message);
    }
}

async function apiRequestEnvelope<T>(
    path: string,
    init?: RequestInit
): Promise<{ data: T; meta?: { page: number; limit: number; hasMore: boolean } }> {
    const response = await fetch(`${apiOrigin}${path}`, {
        ...init,
        credentials: "include",
        cache: "no-store",
        headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers
    }).catch(() => {
        throw new Error("The Roamboard API is unavailable. Start the backend and try again.");
    });
    if (response.status === 204) return { data: undefined as T };
    if (!response.headers.get("content-type")?.includes("application/json"))
        throw new Error(`The Roamboard API returned ${response.status} instead of JSON.`);
    const body = (await response.json()) as {
        data?: T;
        meta?: { page: number; limit: number; hasMore: boolean };
        error?: { code?: string; message?: string };
    };
    if (!response.ok || body.data === undefined) {
        throw new ProfileApiError(
            response.status,
            body.error?.code ?? "UNKNOWN",
            body.error?.message ?? "The Roamboard API could not complete that request."
        );
    }
    return { data: body.data, meta: body.meta };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
    return (await apiRequestEnvelope<T>(path, init)).data;
}

export function loadProfile() {
    return apiRequest<UserProfile>("/api/v1/users/me").then(resolveProfilePicture);
}

export function loadPublicProfile(handle: string) {
    return apiRequest<PublicProfileView>(`/api/v1/users/by-handle/${encodeURIComponent(handle)}`).then((view) => ({
        ...view,
        profile: resolveProfilePicture(view.profile)
    }));
}

function accountProfileSaved(): (profile: UserProfile) => UserProfile {
    const publish = captureAccountUpdate();
    return (profile) => {
        publish({
            userId: profile.id,
            username: profile.username,
            displayName: profile.displayName,
            profilePictureUrl: profile.profilePicture?.url ?? null
        });
        return profile;
    };
}

export function updateProfile(
    changes: Pick<
        UserProfile,
        | "revision"
        | "username"
        | "displayName"
        | "description"
        | "location"
        | "occupation"
        | "languages"
        | "interests"
        | "defaultBoardVisibility"
    >
) {
    const profileSaved = accountProfileSaved();
    return apiRequest<UserProfile>("/api/v1/users/me", {
        method: "PATCH",
        body: JSON.stringify(changes)
    })
        .then(resolveProfilePicture)
        .then(profileSaved);
}

export function setProfilePicture(imageId: number) {
    const profileSaved = accountProfileSaved();
    return apiRequest<UserProfile>("/api/v1/users/me/profile-picture", {
        method: "PUT",
        body: JSON.stringify({ imageId })
    })
        .then(resolveProfilePicture)
        .then(profileSaved);
}

export function deleteProfilePicture() {
    const profileSaved = accountProfileSaved();
    return apiRequest<UserProfile>("/api/v1/users/me/profile-picture", {
        method: "DELETE"
    })
        .then(resolveProfilePicture)
        .then(profileSaved);
}

export function loadProfileStats() {
    return apiRequest<ProfileStats>("/api/v1/users/me/stats");
}

export function loadOwnBoards() {
    return apiRequest<ProfileBoard[]>("/api/v1/users/me/boards");
}

export function loadRecentBoards() {
    return apiRequest<ProfileBoard[]>("/api/v1/users/me/recent-boards");
}

export function loadMapDestinations(scope: "published" | "saved" = "published", profileHandle?: string) {
    if (scope === "saved" && profileHandle)
        return apiRequest<MapDestination[]>(
            `/api/v1/users/by-handle/${encodeURIComponent(profileHandle)}/saved-map-destinations`
        );
    return apiRequest<MapDestination[]>(`/api/v1/users/me/map-destinations?scope=${scope}`);
}

export function loadLanguages() {
    return apiRequest<string[]>("/api/v1/languages");
}

export function loadPublishedBoards() {
    return apiRequest<PublishedBoardSummary[]>("/api/v1/boards?scope=published&page=1&limit=10");
}

export function loadSavedBoards(page = 1, limit = 20) {
    return apiRequest<SavedBoardSummary[]>(`/api/v1/users/me/saved-boards?page=${page}&limit=${limit}`);
}

export function loadSavedBoardsPage(page = 1, limit = 20) {
    return apiRequestEnvelope<SavedBoardSummary[]>(`/api/v1/users/me/saved-boards?page=${page}&limit=${limit}`);
}

export function saveBoardBookmark(boardId: number) {
    return apiRequest<{ boardId: number; saved: true }>(`/api/v1/boards/${boardId}/save`, { method: "PUT" });
}

export function unsaveBoardBookmark(boardId: number) {
    return apiRequest<void>(`/api/v1/boards/${boardId}/save`, { method: "DELETE" });
}

export function createBoard(input: {
    title: string;
    isCompleted: boolean;
    destinations: Array<{
        country: string;
        countryCode: string;
        city: string;
        latitude: number;
        longitude: number;
    }>;
}) {
    return saveBoardDocument({
        status: "published",
        title: input.title,
        description: null,
        visibility: "collaborators",
        isCompleted: input.isCompleted,
        tagIds: [],
        imageIds: [],
        coverImageId: null,
        days: [
            {
                dayNumber: 1,
                date: null,
                activities: input.destinations.map((place, position) => ({
                    position,
                    title: place.city,
                    activityTime: null,
                    category: "city",
                    note: null,
                    source: "geoapify",
                    locationConfirmed: true,
                    location: {
                        name: place.city,
                        latitude: place.latitude,
                        longitude: place.longitude,
                        address: null,
                        city: place.city,
                        country: place.country,
                        externalPlaceId: null
                    },
                    uploadedImageIds: [],
                    coverImageId: null,
                    externalImage: null
                }))
            }
        ]
    });
}

function resolveProfilePicture<T extends { profilePicture: UserProfile["profilePicture"] }>(profile: T): T {
    if (!profile.profilePicture?.url) return profile;
    // Image paths belong to the API, which can run on a different origin from the frontend.
    return {
        ...profile,
        profilePicture: {
            ...profile.profilePicture,
            url: new URL(profile.profilePicture.url, apiOrigin).toString()
        }
    };
}

export function sendFriendRequest(handle: string) {
    return apiRequest<{ requestId: number; status: FriendshipStatus }>(
        `/api/v1/users/by-handle/${encodeURIComponent(handle)}/friend-request`,
        { method: "POST" }
    );
}

export function loadFriendRequests() {
    return apiRequest<FriendRequest[]>("/api/v1/users/me/friend-requests").then((requests) =>
        requests.map((req) => ({
            ...req,
            requester: {
                ...req.requester,
                profilePictureUrl: req.requester.profilePictureUrl
                    ? new URL(req.requester.profilePictureUrl, apiOrigin).toString()
                    : null
            }
        }))
    );
}

export type FriendRequestEvent = {
    type: "accept" | "reject";
    requestId: number;
};

const friendRequestListeners = new Set<(event: FriendRequestEvent) => void>();

export function subscribeToFriendRequestUpdates(listener: (event: FriendRequestEvent) => void): () => void {
    friendRequestListeners.add(listener);
    return () => {
        friendRequestListeners.delete(listener);
    };
}

export function notifyFriendRequestAction(event: FriendRequestEvent): void {
    friendRequestListeners.forEach((listener) => {
        try {
            listener(event);
        } catch {
            // noop
        }
    });
}

export async function acceptFriendRequest(requestId: number) {
    const result = await apiRequest<{ requestId: number; status: "accepted" }>(
        `/api/v1/users/me/friend-requests/${requestId}/accept`,
        { method: "PUT" }
    );
    notifyFriendRequestAction({ type: "accept", requestId });
    return result;
}

export async function rejectFriendRequest(requestId: number) {
    await apiRequest<void>(`/api/v1/users/me/friend-requests/${requestId}`, { method: "DELETE" });
    notifyFriendRequestAction({ type: "reject", requestId });
}

export function removeFriend(targetUserId: string) {
    return apiRequest<void>(`/api/v1/users/me/friends/${encodeURIComponent(targetUserId)}`, { method: "DELETE" });
}

export function removeFriendByHandle(handle: string) {
    return apiRequest<void>(`/api/v1/users/by-handle/${encodeURIComponent(handle)}/friend`, { method: "DELETE" });
}

export type FriendUser = {
    friendshipId?: number;
    acceptedAt?: string | null;
    userId: string;
    username: string;
    displayName: string;
    profilePictureUrl: string | null;
    bio: string | null;
    location: string | null;
};

export type UserSearchResult = FriendUser & {
    friendshipStatus: "none" | "pending_sent" | "pending_received" | "accepted";
    requestId?: number;
};

export type FriendBoardSummary = {
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
};

export type FriendActivityItem = {
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
};

export function loadFriends() {
    return apiRequest<FriendUser[]>("/api/v1/users/me/friends").then((friends) =>
        friends.map((friend) => ({
            ...friend,
            profilePictureUrl: friend.profilePictureUrl ? new URL(friend.profilePictureUrl, apiOrigin).toString() : null
        }))
    );
}

export function searchUsers(query = "", limit = 20) {
    const cleanQuery = query.replace(/^@+/, "").trim();
    const endpoint = cleanQuery
        ? `/api/v1/users/search?q=${encodeURIComponent(cleanQuery)}&limit=${limit}`
        : `/api/v1/users/search?limit=${limit}`;
    return apiRequest<UserSearchResult[]>(endpoint).then((users) =>
        users.map((user) => ({
            ...user,
            profilePictureUrl: user.profilePictureUrl ? new URL(user.profilePictureUrl, apiOrigin).toString() : null
        }))
    );
}

export function loadFriendsBoards(limit = 20) {
    return apiRequest<FriendBoardSummary[]>(`/api/v1/users/me/friends/boards?limit=${limit}`).then((boards) =>
        boards.map((board) => ({
            ...board,
            coverImageUrl: board.coverImageUrl ? new URL(board.coverImageUrl, apiOrigin).toString() : null,
            owner: {
                ...board.owner,
                profilePictureUrl: board.owner.profilePictureUrl
                    ? new URL(board.owner.profilePictureUrl, apiOrigin).toString()
                    : null
            }
        }))
    );
}

export function loadFriendsActivity(limit = 20) {
    return apiRequest<FriendActivityItem[]>(`/api/v1/users/me/friends/activity?limit=${limit}`).then((items) =>
        items.map((item) => ({
            ...item,
            coverImageUrl: item.coverImageUrl ? new URL(item.coverImageUrl, apiOrigin).toString() : null,
            owner: {
                ...item.owner,
                profilePictureUrl: item.owner.profilePictureUrl
                    ? new URL(item.owner.profilePictureUrl, apiOrigin).toString()
                    : null
            }
        }))
    );
}
