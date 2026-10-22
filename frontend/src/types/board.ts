import type { BoardTagId } from "@/data/board-tags";

// Import via import type { Board } from "@/types/board";
// Frontend data model until a backend contract is agreed.
export type BoardVisibility = "private" | "friends" | "public";

export type BoardBudget = "low" | "medium" | "high";

export type BoardTravelStyle = "solo" | "couple" | "friends" | "family";

export type BoardDestination = {
    country: string;
    // ISO 3166-1 alpha-3 country code, for example "SWE".
    countryCode: string;
    cities?: string[];
};

export type BoardLocation = {
    // Roamboard's own ID, separate from Google's place ID.
    id: string;
    source: "manual" | "google";
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
    countryCode?: string;
    city?: string;
    // Filled from a Google result when available; manual pins do not need these.
    // The place ID can be used to fetch further Google details later.
    googlePlaceId?: string;
    googleMapsUrl?: string;
};

export type BoardImage = {
    id: string;
    url: string;
    alt: string;
    largeUrl?: string;
    width?: number;
    height?: number;
    source: "application" | "upload";
    photographer?: string;
    photographerUrl?: string;
    sourceUrl?: string;
};

// The type field tells the renderer which kind of board item it has.
export type BoardActivity = {
    id: string;
    type: "activity";
    title: string;
    description: string;
    location?: BoardLocation;
    // One-based itinerary day, independent of calendar dates.
    dayNumber?: number;
    // Local calendar date (YYYY-MM-DD) and time (HH:mm) at the activity location.
    date?: string;
    time?: string;
    images: BoardImage[];
};

export type BoardLocationItem = {
    id: string;
    type: "location";
    location: BoardLocation;
    dayNumber?: number;
    // The user's own notes and photos for this Board entry.
    notes?: string;
    images?: BoardImage[];
};

export type BoardTextItem = {
    id: string;
    type: "text";
    text: string;
    dayNumber?: number;
};

export type BoardImageItem = {
    id: string;
    type: "image";
    image: BoardImage;
    dayNumber?: number;
};

// A board's item list can mix activities with other kinds of content.
export type BoardItem = BoardActivity | BoardLocationItem | BoardTextItem | BoardImageItem;

export type Board = {
    id: string;
    ownerId: string;
    title: string;
    description: string;
    // Sample settings use private; persisted Boards use collaborators for invited-member access.
    visibility: BoardVisibility | "collaborators";
    // Tracks the owner's completed trip. New Boards and copies should start false.
    isCompleted: boolean;
    // Persisted numeric tag IDs as strings, or catalogue IDs for sample Boards.
    tags: BoardTagId[];
    // An empty array allows a Board without a chosen destination.
    destinations: BoardDestination[];
    // Calendar dates in YYYY-MM-DD format.
    startDate?: string;
    endDate?: string;
    // Supports undated trips; keep consistent with the date range when set.
    durationDays?: number;
    // Saved day numbers include empty days and may have gaps.
    dayNumbers?: number[];
    // Saved calendar dates belong to days, including days with no activities.
    dayDates?: Record<number, string>;
    // Optional headings for numbered days, such as "Shibuya to Shinjuku".
    dayTitles?: Record<number, string>;
    budget?: BoardBudget;
    travelStyle?: BoardTravelStyle;
    coverImage?: BoardImage;
    // Array order determines display order, including after drag and drop.
    items: BoardItem[];
    // ISO 8601 timestamps with a timezone, for example "2026-09-30T12:00:00Z".
    createdAt: string;
    updatedAt: string;
};
