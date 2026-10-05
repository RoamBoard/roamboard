export type SocialBoardPreview = {
    id: string;
    titleLines: string[];
    author: string;
    duration: string;
    quote: string;
    tags: string[];
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
    whatsapp: string;
    avatarUrl: string;
    location: string;
    headline: string;
    bio: string;
    tier: string;
    stats: {
        countriesVisited: number;
        boardsCreated: number;
        friendsMade: number;
        placesSaved: number;
        boardsSaved: number;
    };
    facts: string[];
    details: {
        location: string;
        languages: string[];
        overlappingDestinations: number;
        interests: string[];
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

export type AudienceFilter = "ME" | "FRIENDS" | "EXPLORE";

export type UserSettings = {
    theme: "light" | "dark";
    defaultBoardVisibility: "friends" | "public";
    emailNotifications: boolean;
};
