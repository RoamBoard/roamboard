export interface ProviderPhoto {
  id: string;
  url: string;
  thumbnailUrl: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  sourceUrl: string;
  width: number;
  height: number;
}

export interface ProviderPlace {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  types: string[];
}

export interface ProviderConfig {
  mapbox: { configured: boolean; publicToken?: string };
  unsplash: { configured: boolean };
  googlePlaces: { configured: boolean; billingRequired: true };
  cloudinary: { configured: boolean; cloudName?: string };
}

export type RouteProfile = "walking" | "cycling" | "driving";

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface ProviderRoute {
  profile: RouteProfile;
  distanceKm: number;
  durationMinutes: number;
  geometry: Array<[number, number]>;
}

export interface PhotoMetadata {
  capturedAt: string | null;
  camera: string | null;
  orientation: string | null;
  latitude: number | null;
  longitude: number | null;
  hasGps: boolean;
  raw: Record<string, unknown>;
}

export interface CloudinaryAsset {
  publicId: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  createdAt: string;
  metadata?: PhotoMetadata;
}