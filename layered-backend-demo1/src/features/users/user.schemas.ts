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

export const browseBoardsSchema = z.object({ query: z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict() });
export type BrowseBoardsRequest = z.infer<typeof browseBoardsSchema>;

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

const nullableText = (maximum: number) => z.string().trim().max(maximum).nullable();

const detailedBoardLocation = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  country: nullableText(100),
  countryCode: z.string().trim().toUpperCase().refine((value) => value === null || isCountryCode(value), "Choose an existing country").nullable(),
  city: nullableText(120),
  mapboxId: nullableText(300),
}).strict();

const boardPin = z.object({
  id: z.string().uuid(),
  order: z.number().int().min(0).max(500),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  category: z.enum(["landmark", "culture", "museum", "restaurant", "cafe", "bar", "shopping", "park", "nature", "hike", "beach", "neighborhood", "city", "address", "stay", "transit", "event", "activity", "other"]),
  source: z.enum(["manual", "mapbox", "geoapify", "photo"]),
  location: detailedBoardLocation.nullable(),
}).strict();

const boardDay = z.object({
  id: z.string().uuid(),
  dayNumber: z.number().int().min(1).max(60),
  date: z.iso.date().nullable(),
  pins: z.array(boardPin).max(100),
}).strict();

const boardImage = z.object({
  id: z.string().uuid(),
  pinId: z.string().uuid().nullable(),
  publicId: z.string().trim().min(1).max(300),
  source: z.enum(["upload", "unsplash"]),
  url: z.url().max(2000),
  thumbnailUrl: z.url().max(2000),
  width: z.number().int().positive().max(30000),
  height: z.number().int().positive().max(30000),
  capturedAt: nullableText(100),
  latitude: z.number().finite().min(-90).max(90).nullable(),
  longitude: z.number().finite().min(-180).max(180).nullable(),
  order: z.number().int().min(0).max(100),
  credit: nullableText(200),
  creditUrl: z.url().max(2000).nullable(),
  sourceUrl: z.url().max(2000).nullable(),
}).strict().refine((image) => (image.latitude === null) === (image.longitude === null), {
  message: "Image latitude and longitude must be provided together",
});

export const createDetailedBoardSchema = z.object({
  body: z.object({
    title: z.string().trim().max(200),
    description: z.string().trim().max(5000).default(""),
    status: z.enum(["draft", "published"]),
    visibility: z.enum(["private", "friends", "public"]).default("private"),
    tags: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
    vibes: z.array(z.string().trim().min(1).max(50)).max(3).default([]),
    highlights: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
    days: z.array(boardDay).min(1).max(60),
    images: z.array(boardImage).max(10).default([]),
  }).strict().superRefine((body, context) => {
    const pins = body.days.flatMap((day) => day.pins);
    const pinIds = new Set(pins.map((pin) => pin.id));
    if (body.status === "published" && !body.title) {
      context.addIssue({ code: "custom", path: ["title"], message: "Enter a Board title before publishing" });
    }
    if (body.status === "published" && !pins.some((pin) => pin.location)) {
      context.addIssue({ code: "custom", path: ["days"], message: "Add at least one geolocated pin before publishing" });
    }
    if (new Set(body.days.map((day) => day.dayNumber)).size !== body.days.length) {
      context.addIssue({ code: "custom", path: ["days"], message: "Day numbers must be unique" });
    }
    if (new Set(pins.map((pin) => pin.id)).size !== pins.length) {
      context.addIssue({ code: "custom", path: ["days"], message: "Pin IDs must be unique" });
    }
    if (body.images.some((image) => image.pinId !== null && !pinIds.has(image.pinId))) {
      context.addIssue({ code: "custom", path: ["images"], message: "Every image pinId must reference a Board pin" });
    }
  }),
});

export const boardByIdSchema = z.object({ params: boardIdParams });

export type CreateUserRequest = z.infer<typeof createUserSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
export type SetProfilePictureRequest = z.infer<typeof setProfilePictureSchema>;
export type ListBoardsRequest = z.infer<typeof listBoardsSchema>;
export type CreateBoardRequest = z.infer<typeof createBoardSchema>;
export type CreateDetailedBoardRequest = z.infer<typeof createDetailedBoardSchema>;
export type BoardByIdRequest = z.infer<typeof boardByIdSchema>;
