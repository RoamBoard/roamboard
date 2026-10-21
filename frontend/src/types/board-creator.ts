export const dayColors = ["#d4664b", "#376b78", "#8b6f47", "#80648a", "#4f7557", "#b07639"] as const;

export type BoardStatus = "draft" | "published";

export type PinCategory =
    | "landmark"
    | "culture"
    | "museum"
    | "restaurant"
    | "cafe"
    | "bar"
    | "shopping"
    | "park"
    | "nature"
    | "hike"
    | "beach"
    | "neighborhood"
    | "city"
    | "address"
    | "stay"
    | "transit"
    | "event"
    | "activity"
    | "other";

export type PinLocation = {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    country: string | null;
    countryCode: string | null;
    city: string | null;
    mapboxId: string | null;
};

export type BoardPinDraft = {
    id: string;
    serverActivityId?: number;
    coverImageId?: number | null;
    order: number;
    time: string;
    title: string;
    description: string;
    category: PinCategory;
    source: "manual" | "mapbox" | "geoapify" | "photo";
    location: PinLocation | null;
};

export type BoardDayDraft = {
    id: string;
    serverDayId?: number;
    dayNumber: number;
    date: string | null;
    pins: BoardPinDraft[];
};

export type BoardImageDraft = {
    id: string;
    uploadedImageId?: number;
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
    activityOrder?: number;
    credit: string | null;
    creditUrl: string | null;
    sourceUrl: string | null;
};

export type BoardDestinationDraft = PinLocation & { kind: "city" | "region" | "country" };

export type BoardCreatorPayload = {
    fillerImagesEnabled?: boolean;
    destination?: BoardDestinationDraft | null;
    title: string;
    description: string;
    status: BoardStatus;
    visibility: "collaborators" | "friends" | "public";
    coverImageId: number | null;
    tags: string[];
    days: BoardDayDraft[];
    images: BoardImageDraft[];
};

export type CreatedBoard = BoardCreatorPayload & {
    id: string;
    ownerId: string;
    createdAt: string;
    updatedAt: string;
};
