import { z } from "zod";

export const providerSearchSchema = z.object({
  query: z.object({
    q: z.string().trim().min(2).max(100),
    limit: z.coerce.number().int().min(1).max(10).default(5),
  }).strict(),
});

export const providerReverseSchema = z.object({
  query: z.object({
    latitude: z.coerce.number().finite().min(-90).max(90),
    longitude: z.coerce.number().finite().min(-180).max(180),
  }).strict(),
});

export const cloudinaryDeliverySchema = z.object({
  query: z.object({
    publicId: z.string().trim().min(1).max(300),
    width: z.coerce.number().int().min(1).max(3000).default(1200),
    height: z.coerce.number().int().min(1).max(3000).default(675),
    crop: z.enum(["fill", "fit", "limit", "crop"]).default("fill"),
  }).strict(),
});

export const mapboxRouteSchema = z.object({
  body: z.object({
    profile: z.enum(["walking", "cycling", "driving"]).default("walking"),
    points: z.array(z.object({
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
    }).strict()).min(2).max(10),
  }).strict(),
});

export const cloudinaryMetadataSchema = z.object({
  query: z.object({ publicId: z.string().trim().min(1).max(300) }).strict(),
});

export type ProviderSearchRequest = z.infer<typeof providerSearchSchema>;
export type ProviderReverseRequest = z.infer<typeof providerReverseSchema>;
export type CloudinaryDeliveryRequest = z.infer<typeof cloudinaryDeliverySchema>;
export type MapboxRouteRequest = z.infer<typeof mapboxRouteSchema>;
export type CloudinaryMetadataRequest = z.infer<typeof cloudinaryMetadataSchema>;