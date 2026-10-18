import { z } from "zod";
export const smartCreateSchema = z
    .object({
        imageIds: z
            .array(z.number().int().positive())
            .min(1)
            .max(30)
            .refine((ids) => new Set(ids).size === ids.length)
    })
    .strict();
