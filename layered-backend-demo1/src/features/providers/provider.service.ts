import { env } from "../../config/env.js";
import { AppError } from "../../shared/app-error.js";
import { searchMapbox } from "../destinations/destination.providers.js";
import type { DestinationResult } from "../destinations/destination.types.js";
import { loadCloudinaryAssets, loadCloudinaryMetadata, uploadCloudinaryImage } from "./provider.cloudinary.js";
import { reverseMapbox, routeMapbox, searchGooglePlaces, searchUnsplash } from "./provider.providers.js";
import type { CloudinaryAsset, PhotoMetadata, ProviderConfig, ProviderPhoto, ProviderPlace, ProviderRoute, RoutePoint, RouteProfile } from "./provider.types.js";

export interface ProviderService {
  config(): ProviderConfig;
  mapboxSearch(query: string, limit: number): Promise<DestinationResult[]>;
  mapboxReverse(latitude: number, longitude: number): Promise<string>;
  mapboxRoute(points: RoutePoint[], profile: RouteProfile): Promise<ProviderRoute>;
  unsplashSearch(query: string, limit: number): Promise<ProviderPhoto[]>;
  googlePlacesSearch(query: string, limit: number): Promise<ProviderPlace[]>;
  cloudinaryDelivery(publicId: string, width: number, height: number, crop: string): string;
  cloudinaryUpload(file: Express.Multer.File): Promise<CloudinaryAsset>;
  cloudinaryAssets(): Promise<CloudinaryAsset[]>;
  cloudinaryMetadata(publicId: string): Promise<PhotoMetadata>;
}

function required(value: string | undefined, label: string): string {
  if (!value) throw new AppError(503, `${label} is not configured on the API`);
  return value;
}

async function callProvider<T>(name: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new AppError(502, `${name} rejected the request. Check the key and provider access.`);
  }
}

export function createProviderService(): ProviderService {
  return {
    config: () => ({
      mapbox: {
        configured: Boolean(env.MAPBOX_ACCESS_TOKEN),
        ...(env.MAPBOX_ACCESS_TOKEN?.startsWith("pk.") ? { publicToken: env.MAPBOX_ACCESS_TOKEN } : {}),
      },
      unsplash: { configured: Boolean(env.UNSPLASH_ACCESS_KEY) },
      googlePlaces: { configured: Boolean(env.GOOGLE_PLACES_API_KEY), billingRequired: true },
      cloudinary: { configured: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET), cloudName: env.CLOUDINARY_CLOUD_NAME },
    }),
    mapboxSearch: (query, limit) => callProvider("Mapbox", () => searchMapbox(query, limit, required(env.MAPBOX_ACCESS_TOKEN, "Mapbox"))),
    mapboxReverse: (latitude, longitude) => callProvider("Mapbox", () => reverseMapbox(latitude, longitude, required(env.MAPBOX_ACCESS_TOKEN, "Mapbox"))),
    mapboxRoute: (points, profile) => callProvider("Mapbox", () => routeMapbox(points, profile, required(env.MAPBOX_ACCESS_TOKEN, "Mapbox"))),
    unsplashSearch: (query, limit) => callProvider("Unsplash", () => searchUnsplash(query, required(env.UNSPLASH_ACCESS_KEY, "Unsplash"), limit)),
    googlePlacesSearch: (query, limit) => callProvider("Google Places", () => searchGooglePlaces(query, required(env.GOOGLE_PLACES_API_KEY, "Google Places"), limit)),
    cloudinaryDelivery: (publicId, width, height, crop) => {
      const cloudName = required(env.CLOUDINARY_CLOUD_NAME, "Cloudinary");
      if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
        throw new AppError(503, "Cloudinary API credentials are not configured on the API");
      }
      return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/c_${crop},w_${width},h_${height},q_auto,f_auto/${publicId}`;
    },
    cloudinaryUpload: (file) => callProvider("Cloudinary", () => uploadCloudinaryImage(file)),
    cloudinaryAssets: () => callProvider("Cloudinary", loadCloudinaryAssets),
    cloudinaryMetadata: (publicId) => callProvider("Cloudinary", () => loadCloudinaryMetadata(publicId)),
  };
}