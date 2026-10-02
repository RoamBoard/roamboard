import { z } from "zod";

import { countryName, isCountryCode } from "../../shared/countries.js";

const emptyObject = z.object({}).strict();
const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();
const settings = z.record(z.string(), z.json());
const boardIdParams = z.object({ boardId: z.string().uuid() }).strict();

const destination = z.object({
  country: z.string().trim().min(1).max(100),
  countryCode: z.string().trim().toUpperCase().refine(isCountryCode, "Choose an existing country"),
  city: z.string().trim().min(1).max(120),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
}).strict().transform((value) => ({ ...value, country: countryName(value.countryCode) }));

export const createUserSchema = z.object({
  body: z.object({
    username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/),
    displayName: z.string().trim().min(1).max(80),
  }).strict(),
});

export const getCurrentProfileSchema = z.object({ query: emptyObject.optional() });

export const updateProfileSchema = z.object({
  body: z.object({
    displayName: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(1000).optional(),
    location: z.string().trim().min(1).max(120).nullable().optional(),
    interests: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
    settings: settings.optional(),
  }).strict().refine((body) => Object.keys(body).length > 0, { message: "At least one field must be provided" }),
});

export const setProfilePictureSchema = z.object({
  body: z.object({
    url: z.string().url().max(2000).refine(
      (value) => ["http:", "https:"].includes(new URL(value).protocol),
      { message: "Profile picture URL must use HTTP or HTTPS" },
    ),
    storageKey: z.string().trim().min(1).max(500).nullable().default(null),
  }).strict(),
});

export const listBoardsSchema = z.object({ query: listQuery });

export const createBoardSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000).default(""),
    visibility: z.enum(["private", "friends", "public"]).default("private"),
    isCompleted: z.boolean().default(false),
    destinations: z.array(destination).min(1).max(50),
  }).strict(),
});

export const boardByIdSchema = z.object({ params: boardIdParams });

export type CreateUserRequest = z.infer<typeof createUserSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
export type SetProfilePictureRequest = z.infer<typeof setProfilePictureSchema>;
export type ListBoardsRequest = z.infer<typeof listBoardsSchema>;
export type CreateBoardRequest = z.infer<typeof createBoardSchema>;
export type BoardByIdRequest = z.infer<typeof boardByIdSchema>;
