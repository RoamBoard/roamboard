import { z } from "zod";
import { isCountryCode } from "../../shared/countries.js";
const selection = (value: z.ZodString) =>
    z
        .union([value, z.array(value)])
        .transform((values) => [...new Set(Array.isArray(values) ? values : [values])])
        .optional();
const geography = {
    countries: selection(z.string().refine(isCountryCode)),
    continents: selection(
        z
            .string()
            .refine((value) =>
                ["africa", "antarctica", "asia", "europe", "north-america", "oceania", "south-america"].includes(value)
            )
    )
};
export const discoveryPageSchema = z
    .object({
        page: z.coerce.number().int().min(1).max(10000).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20)
    })
    .strict();
const searchFields = discoveryPageSchema.extend({
    ...geography,
    q: z
        .string()
        .trim()
        .max(100)
        .refine((value) => !value || value.length >= 2)
        .default(""),
    location: z.enum(["auto", "off"]).default("auto")
});
export const discoverySearchSchema = searchFields.refine((value) =>
    Boolean(value.q || value.countries?.length || value.continents?.length)
);
export const discoverySuggestionsSchema = searchFields.extend({ q: z.string().trim().min(2).max(100) });
export const featuredSchema = z.object({ period: z.enum(["month", "week"]).default("month") }).strict();
export const viewSchema = z.object({ token: z.uuid().optional() }).strict();

export const collectionParamsSchema = z.object({
    context: z.enum([
        "mine",
        "saved",
        "friends",
        "profile",
        "profile-saved",
        "map",
        "category",
        "destination",
        "recent",
        "featured"
    ])
});
export const collectionQuerySchema = z
    .object({
        ...geography,
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
        tags: selection(z.string().trim().min(1).max(100)).refine((values) => !values || values.length <= 20),
        period: z.enum(["week", "month"]).optional(),
        country: z.string().refine(isCountryCode, "Choose an ISO alpha-3 country").optional(),
        longitude: z.coerce.number().min(-180).max(180).optional(),
        latitude: z.coerce.number().min(-90).max(90).optional(),
        collection: z.enum(["published", "saved", "both"]).optional(),
        status: z.enum(["draft", "published"]).optional()
    })
    .strict();
