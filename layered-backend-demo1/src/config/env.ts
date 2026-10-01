import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
  STORAGE: z.enum(["memory", "postgres"]).default("memory"),
  DATABASE_URL: z.string().url().optional(),
  ELASTICSEARCH_NODE: z.string().url().optional(),
  ELASTIC_CLOUD_ID: z.string().trim().min(1).optional(),
  ELASTIC_API_KEY: z.string().trim().min(1).optional(),
  SEARCH_REINDEX_KEY: z.string().trim().min(1).optional(),
  MAPBOX_ACCESS_TOKEN: z.string().trim().min(1).optional(),
  UNSPLASH_ACCESS_KEY: z.string().trim().min(1).optional(),
  GOOGLE_PLACES_API_KEY: z.string().trim().min(1).optional(),
  CLOUDINARY_CLOUD_NAME: z.string().trim().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().trim().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().trim().min(1).optional(),
}).superRefine((value, context) => {
  const hasCloudId = value.ELASTIC_CLOUD_ID !== undefined;
  const hasApiKey = value.ELASTIC_API_KEY !== undefined;

  if (hasCloudId !== hasApiKey) {
    context.addIssue({
      code: "custom",
      path: ["ELASTIC_CLOUD_ID"],
      message: "ELASTIC_CLOUD_ID and ELASTIC_API_KEY must be provided together",
    });
  }

  if (hasCloudId && value.ELASTICSEARCH_NODE !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["ELASTICSEARCH_NODE"],
      message: "Use either ELASTICSEARCH_NODE or Elastic Cloud credentials",
    });
  }

  if (value.STORAGE === "postgres" && !value.DATABASE_URL) {
    context.addIssue({
      code: "custom",
      path: ["DATABASE_URL"],
      message: "DATABASE_URL is required when STORAGE=postgres",
    });
  }
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment configuration:");
  console.error(result.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...result.data,
  ELASTICSEARCH_NODE: result.data.ELASTICSEARCH_NODE ?? "http://localhost:9200",
};
