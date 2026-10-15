import { z } from "zod";
export const searchSchema = z
    .object({
        q: z.string().trim().min(2).max(100),
        entityType: z.literal("itinerary").optional(),
        country: z.string().trim().max(500).optional(),
        category: z.string().trim().max(500).optional(),
        page: z.coerce.number().int().min(1).max(100).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(10)
    })
    .strict()
    .refine((input) => input.page * input.limit <= 1000, "Choose an earlier page");
export const suggestionSchema = z
    .object({
        q: z.string().trim().min(2).max(100),
        limit: z.coerce.number().int().min(1).max(10).default(6)
    })
    .strict();
