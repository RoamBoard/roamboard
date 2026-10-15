import { z } from "zod";

export const profileChangesSchema = z
    .object({
        displayName: z.string().trim().min(1).max(500),
        description: z.string().trim().max(500),
        location: z.string().trim().max(500).nullable(),
        interests: z.array(z.string().trim().min(1).max(500)).max(3)
    })
    .strict();
export const pictureSchema = z.object({ imageId: z.number().int().positive() }).strict();
