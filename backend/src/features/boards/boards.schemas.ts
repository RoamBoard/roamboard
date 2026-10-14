import { z } from "zod";

const id = z.number().int().positive();
const optionalText = z.string().max(500).nullable();
const httpsUrl = z.string().max(2048).url().refine((value) => value.startsWith("https://"));

const locationSchema = z.object({
    name: z.string().trim().min(1).max(500),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    address: optionalText,
    city: optionalText,
    country: optionalText,
    externalPlaceId: optionalText
}).strict();

const externalImageSchema = z.object({
    provider: z.literal("unsplash"),
    providerImageId: z.string().min(1).max(500),
    url: httpsUrl,
    photographer: z.string().min(1).max(500),
    photographerUrl: httpsUrl.nullable(),
    sourceUrl: httpsUrl.nullable()
}).strict();

const activitySchema = z.object({
    activityId: id.optional(),
    position: z.number().int().nonnegative(),
    title: z.string().trim().min(1).max(500),
    activityTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable(),
    category: z.string().min(1).max(500),
    note: optionalText,
    source: z.enum(["manual", "mapbox", "geoapify", "photo"]),
    location: locationSchema.nullable(),
    locationConfirmed: z.boolean(),
    uploadedImageIds: z.array(id),
    coverImageId: id.nullable().optional(),
    externalImage: externalImageSchema.nullable()
}).strict();

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
});

const daySchema = z.object({
    dayId: id.optional(),
    dayNumber: z.number().int().positive(),
    date: dateSchema.nullable(),
    activities: z.array(activitySchema)
}).strict();

const boardFields = {
    status: z.enum(["draft", "published"]),
    title: z.string().max(500),
    description: optionalText,
    visibility: z.enum(["collaborators", "friends", "public"]),
    tagIds: z.array(id).max(3),
    imageIds: z.array(id).max(10),
    coverImageId: id.nullable().optional(),
    days: z.array(daySchema)
};

export const createBoardSchema = z.object({
    ...boardFields,
    visibility: boardFields.visibility.default("collaborators"),
    tagIds: boardFields.tagIds.default([]),
    imageIds: boardFields.imageIds.default([]),
    days: boardFields.days.default([])
}).strict();

export const replaceBoardSchema = z.object({
    ...boardFields,
    revision: z.number().int().positive()
}).strict();

export const boardIdParamsSchema = z.object({
    boardId: z.coerce.number().int().positive()
}).strict();

export const imageIdParamsSchema = z.object({
    imageId: z.coerce.number().int().positive()
}).strict();

export const boardListQuerySchema = z.object({
    scope: z.enum(["drafts", "published"]),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
}).strict();

export const imageVariantQuerySchema = z.object({
    variant: z.enum(["display", "thumbnail"]).default("display")
}).strict();

export const uploadIntentSchema = z.object({
    fileName: z.string().min(1).max(500),
    contentType: z.string().min(1).max(100),
    sizeBytes: z.number().int().positive()
}).strict();

export const completeUploadSchema = z.object({
    uploadId: z.uuid()
}).strict();

export type BoardWrite = z.infer<typeof createBoardSchema>;
export type BoardReplace = z.infer<typeof replaceBoardSchema>;
export type BoardDayWrite = BoardWrite["days"][number];
export type BoardActivityWrite = BoardDayWrite["activities"][number];
export type BoardLocationWrite = NonNullable<BoardActivityWrite["location"]>;
export type UploadIntentWrite = z.infer<typeof uploadIntentSchema>;
