import { z } from "zod";
import { isCountryCode } from "../../shared/countries.js";

const coordinate = z.coerce.number().finite();

export const destinationSearchSchema = z.object({
    query: z
        .object({
            q: z.string().trim().min(2).max(100),
            limit: z.coerce.number().int().min(1).max(10).default(5)
        })
        .strict()
});

export const destinationContextSchema = z.object({
    query: z
        .object({
            name: z.string().trim().min(1).max(100),
            address: z.string().trim().max(200).default(""),
            latitude: coordinate.min(-90).max(90),
            longitude: coordinate.min(-180).max(180),
            id: z.string().trim().min(1).max(200),
            placeType: z.string().trim().min(1).max(50)
        })
        .strict()
});

export type DestinationSearchRequest = z.infer<typeof destinationSearchSchema>;
export type DestinationContextRequest = z.infer<typeof destinationContextSchema>;

// Query strings must contain actual numbers; an empty string must not become coordinate zero.
const guideCoordinate = z.string().trim().min(1).transform(Number).pipe(z.number().finite());
export const destinationGuideSchema = z
    .object({
        name: z.string().trim().min(1).max(100),
        country: z.string().refine(isCountryCode),
        latitude: guideCoordinate.pipe(z.number().min(-90).max(90)),
        longitude: guideCoordinate.pipe(z.number().min(-180).max(180)),
        page: z
            .string()
            .regex(/^\d+$/)
            .transform(Number)
            .pipe(z.number().int().min(1).max(Number.MAX_SAFE_INTEGER))
            .default(1),
        limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(20)).default(6)
    })
    .strict();

export type DestinationGuideQuery = z.infer<typeof destinationGuideSchema>;

// Details are resolved against the city's existing sights, never a caller-supplied page URL.
export const placeDetailsSchema = destinationGuideSchema.omit({ page: true, limit: true }).extend({
    placeId: z.string().trim().min(1).max(300)
});
export type PlaceDetailsQuery = z.infer<typeof placeDetailsSchema>;

// Match a travel-guide sight for temporary map display only.
export const matchPlaceSchema = z
    .object({
        name: z.string().trim().min(1).max(200),
        city: z.string().trim().min(1).max(100),
        country: z.string().refine(isCountryCode),
        latitude: z.number().finite().min(-90).max(90),
        longitude: z.number().finite().min(-180).max(180)
    })
    .strict();
export type MatchPlaceInput = z.infer<typeof matchPlaceSchema>;
