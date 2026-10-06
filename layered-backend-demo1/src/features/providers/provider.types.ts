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
  googleMapsUrl: string;
}

export interface GooglePlaceDetails {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
  types: string[];
  googleMapsUrl: string;
}

export interface SavedGooglePlaceReference {
  placeId: string;
  savedAt: string;
}

export interface GooglePlaceReferenceRepository {
  save(placeId: string): Promise<SavedGooglePlaceReference>;
  list(): Promise<SavedGooglePlaceReference[]>;
  delete(placeId: string): Promise<boolean>;
}

export interface ProviderConfig {
  mapbox: { configured: boolean };
  geoapify: { configured: boolean };
  unsplash: { configured: boolean };
  googlePlaces: { configured: boolean; billingRequired: true };
  cloudinary: { configured: boolean; cloudName?: string };
}

export interface MapboxMapSession {
  publicToken: string;
}

export interface MapboxLocation {
  id: string;
  label: string;
  detail: string;
  type: string;
  latitude: number;
  longitude: number;
  country?: string | null;
  countryCode?: string | null;
  city?: string | null;
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
