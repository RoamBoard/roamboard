export interface UserProfile {
    id: string;
    username: string;
    displayName: string;
    description: string;
    location: string | null;
    interests: string[];
    profilePicture: { imageId: number; url: string; storageKey: null } | null;
    settings: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface MapDestination {
    id: string;
    boardId?: string;
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
}

export type ProfileChanges = Pick<UserProfile, "displayName" | "description" | "location" | "interests">;
export interface UsersRepository {
    read(userId: string): Promise<UserProfile | null>;
    update(userId: string, input: ProfileChanges): Promise<void>;
    setPicture(userId: string, imageId: number | null): Promise<void>;
    listBoards(userId: string, recent: boolean): Promise<ProfileBoard[]>;
    stats(userId: string): Promise<Record<string, number>>;
}
