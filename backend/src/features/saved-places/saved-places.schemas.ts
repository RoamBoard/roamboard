import { z } from "zod";
import { toCountryCode } from "../../shared/countries.js";

// Keep saved coordinates valid while allowing the provider's original name and address.
export const savedPlaceSchema = z
    .object({
        id: z.string().trim().min(1).max(512),
        name: z.string().trim().min(1).max(200),
        address: z.string().trim().max(1000),
        latitude: z.number().finite().min(-90).max(90),
        longitude: z.number().finite().min(-180).max(180),
        city: z.string().trim().min(1).max(100),
        country: z
            .string()
            .regex(/^[A-Z]{3}$/)
            .refine((value) => toCountryCode(value) === value, "Invalid country")
    })
    .strict();
export const savedPlaceParams = z.object({ placeId: z.string().trim().min(1).max(512) });
