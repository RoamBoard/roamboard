// Import via import type { Board } from "@/types/board";
// Frontend data model until a backend contract is agreed.
export type BoardVisibility = "private" | "friends" | "public";

export type BoardBudget = "low" | "medium" | "high";

export type BoardTravelStyle = "solo" | "couple" | "friends" | "family";

export type BoardDestination = {
  country: string;
  // Two-letter country code, for example "SE".
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
  source: "application" | "upload";
};

export type BoardActivity = {
  id: string;
  type: "activity";
  title: string;
  description: string;
  location?: BoardLocation;
  // Local calendar date (YYYY-MM-DD) and time (HH:mm) at the activity location.
  date?: string;
  time?: string;
  images: BoardImage[];
};

export type BoardLocationItem = {
  id: string;
  type: "location";
  location: BoardLocation;
  // The user's own notes and photos for this Board entry.
  notes?: string;
  images?: BoardImage[];
};

export type BoardTextItem = {
  id: string;
  type: "text";
  text: string;
};

export type BoardImageItem = {
  id: string;
  type: "image";
  image: BoardImage;
};

export type BoardItem =
  | BoardActivity
  | BoardLocationItem
  | BoardTextItem
  | BoardImageItem;

export type Board = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  // Private Boards are visible only to their owner.
  visibility: BoardVisibility;
  // Tracks the owner's completed trip. New Boards and copies should start false.
  isCompleted: boolean;
  tags: string[];
  // An empty array allows a Board without a chosen destination.
  destinations: BoardDestination[];
  // Calendar dates in YYYY-MM-DD format.
  startDate?: string;
  endDate?: string;
  // Supports undated trips; keep consistent with the date range when set.
  durationDays?: number;
  budget?: BoardBudget;
  travelStyle?: BoardTravelStyle;
  coverImage?: BoardImage;
  // Array order determines display order, including after drag and drop.
  items: BoardItem[];
  // ISO 8601 timestamps with a timezone, for example "2026-09-30T12:00:00Z".
  createdAt: string;
  updatedAt: string;
};
