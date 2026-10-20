import { z } from "zod";
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
