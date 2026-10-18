import type { ProviderPhoto } from "../providers/provider.types.js";
import type { DestinationGuideQuery } from "./destination.schemas.js";

export interface DestinationResult {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    placeType: string;
    context: string[];
    country: string | null;
    countryCode: string | null;
    city: string | null;
}

export interface DestinationWeather {
    timezone: string;
    dates: string[];
    minimums: number[];
    maximums: number[];
    precipitation: number[];
}

export interface DestinationArticle {
    title: string;
    description: string;
    url: string;
    thumbnailUrl?: string;
}

export interface DestinationImage {
    id: string;
    url: string;
    alt: string;
    photographer: string;
    photographerUrl: string;
    sourceUrl: string;
}

export interface DestinationContext {
    destination: DestinationResult;
    weather?: DestinationWeather;
    article?: DestinationArticle;
    image?: DestinationImage;
    unavailable: string[];
}

export interface GuideDestination {
    name: string;
    country: string;
    countryCode: string;
    latitude: number;
    longitude: number;
}

export type GuideArticle = Pick<DestinationArticle, "title" | "description" | "url">;

// Display-only Wikivoyage excerpts. Missing content is null; failed reads are listed in unavailable.
export interface CityTip {
    title: string;
    text: string;
    url: string;
}

export interface PlaceDetails {
    placeId: string;
    description: string | null;
    sourceUrl: string;
    image: {
        url: string;
        alt: string;
        width: number;
        height: number;
        author: string;
        sourceUrl: string;
        licenseName: string;
        licenseUrl: string;
    } | null;
    unavailable: Array<"description" | "image">;
}

export interface GuidePlace {
    provider?: "wikivoyage";
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
}

export interface DestinationBoard {
    boardId: number;
    username: string;
    title: string;
    description: string | null;
    durationDays: number;
    tags: string[];
    activityTitles: string[];
    images: Array<{
        url: string;
        alt: string;
        photographer?: string;
        photographerUrl?: string;
        sourceUrl?: string;
    }>;
}

export interface DestinationBoardPage {
    boards: DestinationBoard[];
    hasMore: boolean;
}

export interface DestinationGuide extends DestinationBoardPage {
    destination: GuideDestination;
    cityTip: CityTip | null;
    article: GuideArticle | null;
    images: ProviderPhoto[];
    places: GuidePlace[];
    page: number;
    unavailable: Array<"description" | "images" | "boards" | "places" | "cityTip">;
}

export interface DestinationRepository {
    listPublic(input: DestinationGuideQuery): Promise<DestinationBoardPage>;
}
