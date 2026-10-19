import { z } from "zod";

const id = z.coerce.number().int().positive().safe();
const body = z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0 && Array.from(value).length <= 2000);

export const commentBoardParamsSchema = z.object({ boardId: id }).strict();
export const commentParamsSchema = z.object({ boardId: id, commentId: id }).strict();
export const commentListQuerySchema = z.object({ cursor: z.string().min(1).max(512).optional() }).strict();
export const createCommentSchema = z.object({ body }).strict();
export const editCommentSchema = z.object({ body, revision: z.number().int().positive().safe() }).strict();
