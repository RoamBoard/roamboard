import { z } from "zod";

import { entityTypes } from "./search.types.js";

export const searchSchema = z.object({
    query: z
        .object({
            q: z.string().trim().min(2).max(100),
            entityType: z.enum(entityTypes).optional(),
            country: z
                .string()
                .trim()
                .min(2)
                .max(100)
                .transform((value) => value.toLowerCase())
                .optional(),
            category: z
                .string()
                .trim()
                .min(2)
                .max(100)
                .transform((value) => value.toLowerCase())
                .optional(),
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(25).default(10)
        })
        .strict()
});

export const suggestionsSchema = z.object({
    query: z
        .object({
            q: z.string().trim().min(2).max(100),
            limit: z.coerce.number().int().min(1).max(10).default(5)
        })
        .strict()
});

export const reindexSchema = z.object({
    body: z.object({}).strict()
});

export type SearchRequest = z.infer<typeof searchSchema>;
export type SuggestionsRequest = z.infer<typeof suggestionsSchema>;
