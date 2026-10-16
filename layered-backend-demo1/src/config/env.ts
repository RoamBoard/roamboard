import "dotenv/config";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());

const envSchema = z
    .object({
        NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
        PORT: z.coerce.number().int().positive().default(3000),
        CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
        STORAGE: z.enum(["memory", "postgres"]).default("memory"),
        DATABASE_URL: z.string().url().optional(),
        SEARCH_REINDEX_KEY: optionalString,
        GEOAPIFY_API_KEY: optionalString,
        MAPBOX_ACCESS_TOKEN: optionalString,
        MAPBOX_PUBLIC_TOKEN: optionalString,
        UNSPLASH_ACCESS_KEY: optionalString,
        GOOGLE_PLACES_API_KEY: optionalString,
        CLOUDINARY_CLOUD_NAME: optionalString,
        CLOUDINARY_API_KEY: optionalString,
        CLOUDINARY_API_SECRET: optionalString
    })
    .superRefine((value, context) => {
        if (value.STORAGE === "postgres" && !value.DATABASE_URL) {
            context.addIssue({
                code: "custom",
                path: ["DATABASE_URL"],
                message: "DATABASE_URL is required when STORAGE=postgres"
            });
        }

        if (value.NODE_ENV === "production" && value.STORAGE !== "postgres") {
            context.addIssue({
                code: "custom",
                path: ["STORAGE"],
                message: "Production requires STORAGE=postgres so API quota counters cannot reset on restart"
            });
        }
    });

const result = envSchema.safeParse(process.env);

if (!result.success) {
    console.error("Invalid environment configuration:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = result.data;
