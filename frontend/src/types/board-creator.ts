export const dayColors = [
    "#b87568",
    "#b98a62",
    "#b69b62",
    "#a5a064",
    "#82996b",
    "#649a80",
    "#639b97",
    "#64949f",
    "#6d88aa",
    "#7d7fa9",
    "#947da7",
    "#a77996",
    "#bb8290",
    "#a96960",
    "#a77c57",
    "#a28e56",
    "#8c955e",
    "#6f8c65",
    "#568d79",
    "#538b90",
    "#5a80a0",
    "#7273a0",
    "#8b6d98",
    "#a06b86",
    "#c19783",
    "#b6a07c",
    "#98aa8b",
    "#8eaaa6",
    "#969fb8",
    "#b09aae"
] as const;

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
    color?: string | null;
    dayNumber: number;
    date: string | null;
    pins: BoardPinDraft[];
};

export type PhotoContext = { kind: "illustrative"; scope: "nearby" | "region"; locationLabel: string };

export type BoardImageDraft = {
    context?: PhotoContext | null;
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
