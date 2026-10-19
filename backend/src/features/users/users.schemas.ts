import { z } from "zod";

export const profileChangesSchema = z
    .object({
        revision: z.number().int().positive(),
        username: z
            .string()
            .trim()
            .toLowerCase()
            .min(1)
            .max(64)
            .regex(/^(?:[a-z0-9]|[a-z0-9][a-z0-9._]*[a-z0-9])$/),
        displayName: z.string().trim().min(1).max(500),
        description: z.string().trim().max(500),
        location: z.string().trim().max(500).nullable(),
        occupation: z.string().trim().max(500).nullable(),
        languages: z.array(z.string().trim().min(1).max(500)).max(10),
        interests: z.array(z.string().trim().min(1).max(500)).max(10),
        defaultBoardVisibility: z.enum(["collaborators", "friends", "public"])
    })
    .strict();
export const pictureSchema = z.object({ imageId: z.number().int().positive() }).strict();
export const publicProfileParamsSchema = z.object({
    handle: z
        .string()
        .toLowerCase()
        .min(1)
        .max(64)
        .regex(/^(?:[a-z0-9]|[a-z0-9][a-z0-9._]*[a-z0-9])$/)
});
export const savedBoardsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
});
export const mapQuerySchema = z.object({ scope: z.enum(["visited", "published", "saved"]).optional() });
export const friendRequestIdParamsSchema = z.object({
    requestId: z.coerce.number().int().positive()
});
export const userSearchQuerySchema = z.object({
    q: z.string().trim().max(100).default(""),
    limit: z.coerce.number().int().min(1).max(50).default(20)
});
export const friendsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20)
});
export const targetUserParamsSchema = z.object({
    targetUserId: z.string().trim().min(1).max(100)
});
