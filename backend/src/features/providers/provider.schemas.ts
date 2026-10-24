import { z } from "zod";
import { isCountryCode } from "../../shared/countries.js";

export const providerSearchSchema = z
    .object({
        q: z.string().trim().min(2).max(100),
        limit: z.coerce.number().int().min(1).max(10).default(5)
    })
    .strict();
export const unsplashSearchSchema = providerSearchSchema.extend({
    limit: z.coerce.number().int().min(1).max(20).default(5)
});
export const boardLocationSearchSchema = providerSearchSchema
    .extend({
        latitude: z.coerce.number().finite().min(-90).max(90).optional(),
        longitude: z.coerce.number().finite().min(-180).max(180).optional()
    })
    .refine(
        (query) => (query.latitude === undefined) === (query.longitude === undefined),
        "Supply both location coordinates"
    );
export type BoardLocationSearchRequest = z.infer<typeof boardLocationSearchSchema>;
export const boardDestinationSearchSchema = z
    .object({
        country: z.string().trim().toUpperCase().refine(isCountryCode, "Choose an existing country"),
        city: z.string().trim().min(2).max(120),
        limit: z.coerce.number().int().min(1).max(10).default(5)
    })
    .strict();
export const providerReverseSchema = z
    .object({
        latitude: z.coerce.number().finite().min(-90).max(90),
        longitude: z.coerce.number().finite().min(-180).max(180)
    })
    .strict();
export const boardReverseSchema = providerReverseSchema.extend({ preferPlace: z.literal("true").optional() });

export const cloudinaryDeliverySchema = z
    .object({
        publicId: z.string().trim().min(1).max(300),
        width: z.coerce.number().int().min(1).max(3000).default(1200),
        height: z.coerce.number().int().min(1).max(3000).default(675),
        crop: z.enum(["fill", "fit", "limit", "crop"]).default("fill")
    })
    .strict();
export const mapboxRouteSchema = z
    .object({
        profile: z.enum(["walking", "cycling", "driving"]).default("walking"),
        points: z
            .array(
                z
                    .object({
                        latitude: z.number().finite().min(-90).max(90),
                        longitude: z.number().finite().min(-180).max(180)
                    })
                    .strict()
            )
            .min(2)
            .max(10)
    })
    .strict();
export const cloudinaryMetadataSchema = z.object({ publicId: z.string().trim().min(1).max(300) }).strict();
const googlePlaceId = z.string().trim().min(1).max(512);
export const googlePlaceDetailsSchema = z.object({ placeId: googlePlaceId }).strict();
export const saveGooglePlaceSchema = z.object({ placeId: googlePlaceId }).strict();
export const deleteGooglePlaceSchema = googlePlaceDetailsSchema;

export type ProviderSearchRequest = z.infer<typeof providerSearchSchema>;
export type BoardDestinationSearchRequest = z.infer<typeof boardDestinationSearchSchema>;
export type ProviderReverseRequest = z.infer<typeof providerReverseSchema>;
export type CloudinaryDeliveryRequest = z.infer<typeof cloudinaryDeliverySchema>;
export type MapboxRouteRequest = z.infer<typeof mapboxRouteSchema>;
export type CloudinaryMetadataRequest = z.infer<typeof cloudinaryMetadataSchema>;
export type GooglePlaceDetailsRequest = z.infer<typeof googlePlaceDetailsSchema>;
export type SaveGooglePlaceRequest = z.infer<typeof saveGooglePlaceSchema>;
export type DeleteGooglePlaceRequest = z.infer<typeof deleteGooglePlaceSchema>;

const photoCoordinate = z.union([z.number(), z.string().trim().min(1).pipe(z.coerce.number())]);
export const activityPhotoSchema = z
    .object({
        name: z.string().trim().min(2).max(160),
        city: z.string().trim().max(160).nullable().optional(),
        country: z.string().trim().max(100).nullable().optional(),
        latitude: photoCoordinate.pipe(z.number().finite().min(-90).max(90)),
        longitude: photoCoordinate.pipe(z.number().finite().min(-180).max(180))
    })
    .strict();
export type ActivityPhotoRequest = z.infer<typeof activityPhotoSchema>;

export const areaSuggestionSchema = z
    .object({
        points: z
            .array(
                z
                    .object({
                        latitude: z.number().finite().min(-90).max(90),
                        longitude: z.number().finite().min(-180).max(180),
                        city: z.string().max(500).nullable().optional(),
                        country: z.string().max(100).nullable().optional()
                    })
                    .strict()
            )
            .min(3)
            .max(100)
    })
    .strict();
export type AreaSuggestionRequest = z.infer<typeof areaSuggestionSchema>;

export const photoSuggestionSchema = z
    .object({
        name: z.string().trim().min(2).max(160),
        category: z.enum([
            "landmark",
            "culture",
            "museum",
            "restaurant",
            "cafe",
            "bar",
            "shopping",
            "park",
            "nature",
            "hike",
            "beach",
            "neighborhood",
            "city",
            "address",
            "stay",
            "transit",
            "event",
            "activity",
            "other"
        ]),
        latitude: photoCoordinate.pipe(z.number().finite().min(-90).max(90)),
        longitude: photoCoordinate.pipe(z.number().finite().min(-180).max(180)),
        city: z.string().trim().max(160).optional(),
        countryCode: z.string().refine(isCountryCode, "Choose an existing country").optional()
    })
    .strict();
export const photoSelectionSchema = photoSuggestionSchema.extend({
    photoId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/)
});
export type PhotoSuggestionRequest = z.infer<typeof photoSuggestionSchema>;
