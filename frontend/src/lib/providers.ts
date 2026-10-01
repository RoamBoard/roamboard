export type ProviderConfig = {
  mapbox: { configured: boolean; publicToken?: string };
  unsplash: { configured: boolean };
  googlePlaces: { configured: boolean; billingRequired: true };
  cloudinary: { configured: boolean; cloudName?: string };
};

export type ProviderPlace = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  types: string[];
};

export type ProviderPhoto = {
  id: string;
  url: string;
  thumbnailUrl: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  sourceUrl: string;
  width: number;
  height: number;
};

export type ProviderRoute = {
  profile: "walking" | "cycling" | "driving";
  distanceKm: number;
  durationMinutes: number;
  geometry: Array<[number, number]>;
};

export type PhotoMetadata = {
  capturedAt: string | null;
  camera: string | null;
  orientation: string | null;
  latitude: number | null;
  longitude: number | null;
  hasGps: boolean;
  raw: Record<string, unknown>;
};

export type CloudinaryAsset = {
  publicId: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  createdAt: string;
  metadata?: PhotoMetadata;
};

const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiOrigin}${path}`, init);
  const body = (await response.json()) as { data?: T; error?: { message?: string } };
  if (!response.ok || body.data === undefined) throw new Error(body.error?.message ?? "The provider request failed.");
  return body.data;
}

export const loadProviderConfig = () => request<ProviderConfig>("/api/v1/providers/config");

export const searchMapboxProvider = (query: string) => request<ProviderPlace[]>(`/api/v1/providers/mapbox/search?q=${encodeURIComponent(query)}`);

export const reverseMapboxProvider = (latitude: string, longitude: string) => request<{ address: string }>(`/api/v1/providers/mapbox/reverse?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`);

export const routeMapboxProvider = (points: Array<{ latitude: number; longitude: number }>, profile: ProviderRoute["profile"]) => request<ProviderRoute>("/api/v1/providers/mapbox/directions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ points, profile }) });

export const searchUnsplashProvider = (query: string) => request<ProviderPhoto[]>(`/api/v1/providers/unsplash/search?q=${encodeURIComponent(query)}`);

export const searchGooglePlacesProvider = (query: string) => request<ProviderPlace[]>(`/api/v1/providers/google-places/search?q=${encodeURIComponent(query)}`);

export const buildCloudinaryDelivery = (publicId: string, width: string, height: string, crop: string) => request<{ url: string }>(`/api/v1/providers/cloudinary/delivery?publicId=${encodeURIComponent(publicId)}&width=${encodeURIComponent(width)}&height=${encodeURIComponent(height)}&crop=${encodeURIComponent(crop)}`);

export async function uploadCloudinaryProvider(file: File): Promise<CloudinaryAsset> {
  const form = new FormData();
  form.append("file", file, file.name);
  const response = await fetch(`${apiOrigin}/api/v1/providers/cloudinary/upload`, { method: "POST", body: form });
  const body = (await response.json()) as { data?: CloudinaryAsset; error?: { message?: string } };
  if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Cloudinary upload failed.");
  return body.data;
}

export const loadCloudinaryProviderAssets = () => request<CloudinaryAsset[]>("/api/v1/providers/cloudinary/assets");

export const loadCloudinaryProviderMetadata = (publicId: string) => request<{ publicId: string; metadata: PhotoMetadata }>(`/api/v1/providers/cloudinary/metadata?publicId=${encodeURIComponent(publicId)}`);
