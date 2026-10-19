import { z } from "zod";

const id = z.coerce.number().int().positive().safe();

export const subscriptionParamsSchema = z.object({ boardId: id }).strict();
export const notificationParamsSchema = z.object({ notificationId: id }).strict();
export const notificationQuerySchema = z.object({ cursor: z.string().min(1).max(512).optional() }).strict();
export const subscriptionBodySchema = z.object({ enabled: z.boolean() }).strict();
