import { z } from "zod";

const coordinate = z.coerce.number().finite();

export const destinationSearchSchema = z.object({
    query: z
        .object({
            q: z.string().trim().min(2).max(100),
            limit: z.coerce.number().int().min(1).max(10).default(5)
        })
        .strict()
});

export const destinationContextSchema = z.object({
    query: z
        .object({
            name: z.string().trim().min(1).max(100),
            address: z.string().trim().max(200).default(""),
            latitude: coordinate.min(-90).max(90),
            longitude: coordinate.min(-180).max(180),
            id: z.string().trim().min(1).max(200),
            placeType: z.string().trim().min(1).max(50)
        })
        .strict()
});

export type DestinationSearchRequest = z.infer<typeof destinationSearchSchema>;
export type DestinationContextRequest = z.infer<typeof destinationContextSchema>;
