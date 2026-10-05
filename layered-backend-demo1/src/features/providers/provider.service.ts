import { env } from "../../config/env.js";
import { AppError } from "../../shared/app-error.js";
import { searchMapbox, searchMapboxCities, searchMapboxPermanent } from "../destinations/destination.providers.js";
import type { DestinationResult } from "../destinations/destination.types.js";
import type { QuotaService } from "../quotas/quota.service.js";
import { loadCloudinaryAssets, loadCloudinaryMetadata, uploadCloudinaryImage } from "./provider.cloudinary.js";
import { fetchGooglePlaceDetails, reverseMapbox, routeMapbox, searchGooglePlaces, searchUnsplash } from "./provider.providers.js";
import type { CloudinaryAsset, GooglePlaceDetails, GooglePlaceReferenceRepository, MapboxLocation, MapboxMapSession, PhotoMetadata, ProviderConfig, ProviderPhoto, ProviderPlace, ProviderRoute, RoutePoint, RouteProfile, SavedGooglePlaceReference } from "./provider.types.js";

export interface ProviderService {
  config(): ProviderConfig;
  mapboxMapSession(): Promise<MapboxMapSession>;
  mapboxSearch(query: string, limit: number): Promise<DestinationResult[]>;
  mapboxBoardSearch(query: string, limit: number): Promise<DestinationResult[]>;
  mapboxDestinationSearch(country: string, city: string, limit: number): Promise<DestinationResult[]>;
  mapboxReverse(latitude: number, longitude: number): Promise<MapboxLocation>;
  mapboxBoardReverse(latitude: number, longitude: number): Promise<MapboxLocation>;
  mapboxRoute(points: RoutePoint[], profile: RouteProfile): Promise<ProviderRoute>;
  unsplashSearch(query: string, limit: number): Promise<ProviderPhoto[]>;
  googlePlacesSearch(query: string, limit: number): Promise<ProviderPlace[]>;
  googlePlaceDetails(placeId: string): Promise<GooglePlaceDetails>;
  saveGooglePlace(placeId: string): Promise<SavedGooglePlaceReference>;
  savedGooglePlaces(): Promise<SavedGooglePlaceReference[]>;
  deleteSavedGooglePlace(placeId: string): Promise<void>;
  cloudinaryDelivery(publicId: string, width: number, height: number, crop: string): string;
  cloudinaryUpload(file: Express.Multer.File): Promise<CloudinaryAsset>;
  cloudinaryAssets(): Promise<CloudinaryAsset[]>;
  cloudinaryMetadata(publicId: string): Promise<PhotoMetadata>;
}

function required(value: string | undefined, label: string): string {
  if (!value) throw new AppError(503, `${label} is not configured on the API`);
  return value;
}

function requireCloudinary(): void {
  required(env.CLOUDINARY_CLOUD_NAME, "Cloudinary");
  required(env.CLOUDINARY_API_KEY, "Cloudinary");
  required(env.CLOUDINARY_API_SECRET, "Cloudinary");
}

function publicMapboxToken(): string | undefined {
  return env.MAPBOX_PUBLIC_TOKEN ?? (env.MAPBOX_ACCESS_TOKEN?.startsWith("pk.") ? env.MAPBOX_ACCESS_TOKEN : undefined);
}

async function callProvider<T>(name: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(502, `${name} rejected the request. Check the key and provider access.`);
  }
}

export function createProviderService(quota: QuotaService, googlePlaceReferences: GooglePlaceReferenceRepository): ProviderService {
  return {
    config: () => ({
      mapbox: {
        configured: Boolean(env.MAPBOX_ACCESS_TOKEN && publicMapboxToken()),
      },
      unsplash: { configured: Boolean(env.UNSPLASH_ACCESS_KEY) },
      googlePlaces: { configured: Boolean(env.GOOGLE_PLACES_API_KEY), billingRequired: true },
      cloudinary: { configured: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET), cloudName: env.CLOUDINARY_CLOUD_NAME },
    }),
    mapboxMapSession: async () => {
      const token = required(publicMapboxToken(), "Mapbox public token");
      if (!token.startsWith("pk.")) throw new AppError(503, "Mapbox map display requires a public pk. token");
      await quota.reserve("mapbox.map_loads");
      return { publicToken: token };
    },
    mapboxSearch: async (query, limit) => {
      const token = required(env.MAPBOX_ACCESS_TOKEN, "Mapbox");
      return callProvider("Mapbox", () => quota.run("mapbox.geocoding", () => searchMapbox(query, limit, token)));
    },
    mapboxBoardSearch: async (query, limit) => {
      const token = required(env.MAPBOX_ACCESS_TOKEN, "Mapbox");
      return callProvider("Mapbox", () => quota.run("mapbox.permanent_geocoding", () => searchMapboxPermanent(query, limit, token)));
    },
    mapboxDestinationSearch: async (country, city, limit) => {
      const token = required(env.MAPBOX_ACCESS_TOKEN, "Mapbox");
      return callProvider("Mapbox", () => quota.run("mapbox.permanent_geocoding", () => searchMapboxCities(country, city, limit, token)));
    },
    mapboxReverse: async (latitude, longitude) => {
      const token = required(env.MAPBOX_ACCESS_TOKEN, "Mapbox");
      return callProvider("Mapbox", () => quota.run("mapbox.geocoding", () => reverseMapbox(latitude, longitude, token)));
    },
    mapboxBoardReverse: async (latitude, longitude) => {
      const token = required(env.MAPBOX_ACCESS_TOKEN, "Mapbox");
      return callProvider("Mapbox", () => quota.run("mapbox.permanent_geocoding", () => reverseMapbox(latitude, longitude, token, true)));
    },
    mapboxRoute: async (points, profile) => {
      const token = required(env.MAPBOX_ACCESS_TOKEN, "Mapbox");
      return callProvider("Mapbox", () => quota.run("mapbox.directions", () => routeMapbox(points, profile, token)));
    },
    unsplashSearch: async (query, limit) => {
      const key = required(env.UNSPLASH_ACCESS_KEY, "Unsplash");
      return callProvider("Unsplash", () => quota.run("unsplash.requests", () => searchUnsplash(query, key, limit)));
    },
    googlePlacesSearch: async (query, limit) => {
      const key = required(env.GOOGLE_PLACES_API_KEY, "Google Places");
      return callProvider("Google Places", () => quota.run("google.places_text_search_pro", () => searchGooglePlaces(query, key, limit)));
    },
    googlePlaceDetails: async (placeId) => {
      const key = required(env.GOOGLE_PLACES_API_KEY, "Google Places");
      return callProvider("Google Places", () => quota.run("google.place_details_essentials", () => fetchGooglePlaceDetails(placeId, key)));
    },
    saveGooglePlace: (placeId) => googlePlaceReferences.save(placeId),
    savedGooglePlaces: () => googlePlaceReferences.list(),
    deleteSavedGooglePlace: async (placeId) => {
      if (!await googlePlaceReferences.delete(placeId)) throw new AppError(404, "The saved Google Place ID was not found.");
    },
    cloudinaryDelivery: (publicId, width, height, crop) => {
      const cloudName = required(env.CLOUDINARY_CLOUD_NAME, "Cloudinary");
      if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
        throw new AppError(503, "Cloudinary API credentials are not configured on the API");
      }
      return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/c_${crop},w_${width},h_${height},q_auto,f_auto/${publicId}`;
    },
    cloudinaryUpload: (file) => callProvider("Cloudinary", () => uploadCloudinaryImage(file)),
    cloudinaryAssets: () => {
      requireCloudinary();
      return callProvider("Cloudinary", () => quota.run("cloudinary.admin", loadCloudinaryAssets));
    },
    cloudinaryMetadata: (publicId) => {
      requireCloudinary();
      return callProvider("Cloudinary", () => quota.run("cloudinary.admin", () => loadCloudinaryMetadata(publicId)));
    },
  };
}
