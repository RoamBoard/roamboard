import { z } from "zod";
import { isCountryCode } from "../../shared/countries.js";
export const discoveryPageSchema = z
    .object({
        page: z.coerce.number().int().min(1).max(10000).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20)
    })
    .strict();
export const discoverySearchSchema = discoveryPageSchema.extend({
    q: z.string().trim().min(2).max(100),
    location: z.enum(["auto", "off"]).default("auto")
});
export const featuredSchema = z.object({ period: z.enum(["month", "week"]).default("month") }).strict();
export const viewSchema = z.object({ token: z.uuid().optional() }).strict();

export const collectionParamsSchema = z.object({
    context: z.enum(["mine", "saved", "friends", "profile", "profile-saved", "map", "category", "recent", "featured"])
});
export const collectionQuerySchema = z
    .object({
        q: z
            .string()
            .trim()
            .max(100)
            .transform((value) => value || undefined)
            .refine((value) => !value || value.length >= 2)
            .optional(),
        sort: z
            .enum([
                "relevance",
                "title-asc",
                "title-desc",
                "published-desc",
                "updated-desc",
                "saved-count-desc",
                "saved-at-desc"
            ])
            .optional(),
        page: z.coerce.number().int().min(1).max(10000).default(1),
        limit: z.coerce
            .number()
            .int()
            .refine((value) => value === 20)
            .default(20),
        handle: z.string().trim().min(1).max(100).optional(),
        tag: z.string().trim().min(1).max(100).optional(),
        period: z.enum(["week", "month"]).optional(),
        country: z.string().refine(isCountryCode, "Choose an ISO alpha-3 country").optional(),
        longitude: z.coerce.number().min(-180).max(180).optional(),
        latitude: z.coerce.number().min(-90).max(90).optional(),
        collection: z.enum(["published", "saved", "both"]).optional(),
        status: z.enum(["draft", "published"]).optional()
    })
    .strict();
