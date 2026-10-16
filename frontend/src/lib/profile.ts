import { saveBoardDocument } from "@/lib/board-creator-api";

export type UserProfile = {
    id: string;
    username: string;
    displayName: string;
    description: string;
    location: string | null;
    interests: string[];
    profilePicture: { imageId: number; url: string; storageKey: string | null } | null;
    settings: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
};

export type ProfileStats = {
    countriesVisited: number;
    boardsCreated: number;
    friends: number;
    placesSaved: number;
    boardsSaved: number;
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
    boardId?: string;
    boardTitle?: string;
    country: string;
    countryCode: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    isCompleted?: boolean;
};

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiOrigin}${path}`, {
        ...init,
        credentials: "include",
        headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers
    });
    if (response.status === 204) return undefined as T;
    const body = (await response.json()) as {
        data?: T;
        error?: { message?: string };
    };
    if (!response.ok || body.data === undefined) {
        throw new Error(body.error?.message ?? "The Roamboard API could not complete that request.");
    }
    return body.data;
}

export function loadProfile() {
    return apiRequest<UserProfile>("/api/v1/users/me").then(resolveProfilePicture);
}

export function updateProfile(changes: Pick<UserProfile, "displayName" | "description" | "location" | "interests">) {
    return apiRequest<UserProfile>("/api/v1/users/me", {
        method: "PATCH",
        body: JSON.stringify(changes)
    });
}

export function setProfilePicture(imageId: number) {
    return apiRequest<UserProfile>("/api/v1/users/me/profile-picture", {
        method: "PUT",
        body: JSON.stringify({ imageId })
    });
}

export function deleteProfilePicture() {
    return apiRequest<UserProfile>("/api/v1/users/me/profile-picture", {
        method: "DELETE"
    });
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

export function loadMapDestinations() {
    return apiRequest<MapDestination[]>("/api/v1/users/me/map-destinations");
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

function resolveProfilePicture(profile: UserProfile): UserProfile {
    if (!profile.profilePicture?.url) return profile;
    return {
        ...profile,
        profilePicture: {
            ...profile.profilePicture,
            url: new URL(profile.profilePicture.url, apiOrigin).toString()
        }
    };
}
