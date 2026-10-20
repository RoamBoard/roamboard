import type { BoardTagId } from "@/data/board-tags";

export type SocialBoardPreview = {
    id: string;
    titleLines: string[];
    author: string;
    duration: string;
    quote: string;
    tags: BoardTagId[];
    highlights: string[];
    savedCount: string;
    countryCode: string;
    images: {
        url: string;
        alt: string;
    }[];
};

export type MapPin = {
    id: string;
    name: string;
    country: string;
    latitude: number;
    longitude: number;
    status: "visited" | "bucketList";
};

export type TravelMilestone = {
    id: string;
    label: string;
    value: string;
    subLabel: string;
    images: {
        url: string;
        alt: string;
    }[];
};

export type UserProfile = {
    id: string;
    name: string;
    handle: string;
    avatarUrl: string;
    location: string;
    headline: string;
    bio: string;
    occupation?: string;
    tier: string;
    stats: {
        countriesVisited: number;
        boardsCreated: number;
        friendsMade: number;
        placesSaved: number;
        boardsSaved: number;
    };
    details: {
        location: string;
        languages: string[];
        occupation?: string;
        tags: BoardTagId[];
        interests?: BoardTagId[];
    };
    inspiredBoards: SocialBoardPreview[];
    myBoards: SocialBoardPreview[];
    mapStats: {
        countriesVisited: number;
        citiesExplored: number;
        continentsCovered: number;
        photosTaken: number;
    };
    mapPins: MapPin[];
    milestones: TravelMilestone[];
};

export type AudienceFilter = "ME" | "FRIENDS";

export type UserSettings = {
    theme: "light" | "dark";
    defaultBoardVisibility: "private" | "friends" | "public";
    emailNotifications: boolean;
};
