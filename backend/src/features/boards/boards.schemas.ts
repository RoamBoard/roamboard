import { isCountryCode } from "../../shared/countries.js";
import { z } from "zod";
import { imageEditSchema } from "../images/images.schemas.js";

const id = z.number().int().positive();
const optionalText = z.string().max(500).nullable();
const httpsUrl = z
    .string()
    .max(2048)
    .url()
    .refine((value) => value.startsWith("https://"));

const locationSchema = z
    .object({
        name: z.string().trim().min(1).max(500),
        latitude: z.number().finite().min(-90).max(90),
        longitude: z.number().finite().min(-180).max(180),
        address: optionalText,
        city: optionalText,
        country: optionalText,
        externalPlaceId: optionalText
    })
    .strict();

const externalImageSchema = z
    .object({
        provider: z.literal("unsplash"),
        providerImageId: z.string().min(1).max(500),
        url: httpsUrl,
        photographer: z.string().min(1).max(500),
        photographerUrl: httpsUrl.nullable(),
        sourceUrl: httpsUrl.nullable(),
        context: z
            .object({
                kind: z.literal("illustrative"),
                scope: z.enum(["nearby", "region"]),
                locationLabel: z.string().trim().min(1).max(500)
            })
            .strict()
            .nullable()
            .optional()
    })
    .strict();

export const activityPhotoSchema = z.discriminatedUnion("source", [
    z.object({ source: z.literal("upload"), imageId: id }).strict(),
    externalImageSchema
        .omit({ provider: true })
        .extend({
            source: z.literal("unsplash"),
            thumbnailUrl: httpsUrl,
            alt: z.string().max(2000),
            width: z.number().int().positive(),
            height: z.number().int().positive(),
            presentation: imageEditSchema.nullable().optional()
        })
        .strict()
]);
export const coverPhotoSchema = z.discriminatedUnion("source", [
    z.object({ source: z.literal("upload"), imageId: id }).strict(),
    z.object({ source: z.literal("unsplash"), providerImageId: z.string().min(1).max(500) }).strict()
]);
export type ActivityPhoto = z.infer<typeof activityPhotoSchema>;
export type CoverPhoto = z.infer<typeof coverPhotoSchema>;
export const legacyMediaPresence = Symbol("legacyMediaPresence");

const activitySchema = z
    .object({
        activityId: id.optional(),
        position: z.number().int().nonnegative(),
        title: z.string().trim().min(1).max(500),
        activityTime: z
            .string()
            .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
            .nullable(),
        category: z.string().min(1).max(500),
        note: optionalText,
        source: z.enum(["manual", "mapbox", "geoapify", "photo"]),
        location: locationSchema.nullable(),
        locationConfirmed: z.boolean(),
        uploadedImageIds: z.array(id).optional(),
        photos: z.array(activityPhotoSchema).optional(),
        coverPhoto: coverPhotoSchema.nullable().optional(),
        coverImageId: id.nullable().optional(),
        externalImage: externalImageSchema.nullable().optional()
    })
    .strict()
    .superRefine((value, context) => {
        if (
            value.photos !== undefined &&
            [value.uploadedImageIds, value.externalImage, value.coverImageId].some((field) => field !== undefined)
        )
            context.addIssue({ code: "custom", message: "Use photos without legacy media fields" });
        if (value.photos) {
            const keys = value.photos.map((photo) =>
                photo.source === "upload" ? `upload:${photo.imageId}` : `unsplash:${photo.providerImageId}`
            );
            if (new Set(keys).size !== keys.length)
                context.addIssue({ code: "custom", message: "Duplicate activity photo" });
            for (const photo of value.photos)
                if (
                    photo.source === "unsplash" &&
                    [photo.url, photo.thumbnailUrl].some((url) => new URL(url).hostname !== "images.unsplash.com")
                )
                    context.addIssue({ code: "custom", message: "Use canonical Unsplash URLs" });
            if (
                value.coverPhoto &&
                !keys.includes(
                    value.coverPhoto.source === "upload"
                        ? `upload:${value.coverPhoto.imageId}`
                        : `unsplash:${value.coverPhoto.providerImageId}`
                )
            )
                context.addIssue({ code: "custom", message: "Cover must be attached" });
        }
    })
    .transform((value) => {
        const external = value.photos?.find((photo) => photo.source === "unsplash");
        return {
            ...value,
            ...(value.uploadedImageIds === undefined || value.externalImage === undefined
                ? {
                      [legacyMediaPresence]: {
                          uploads: value.uploadedImageIds !== undefined,
                          external: value.externalImage !== undefined
                      }
                  }
                : {}),
            uploadedImageIds: value.photos
                ? value.photos.flatMap((photo) => (photo.source === "upload" ? [photo.imageId] : []))
                : (value.uploadedImageIds ?? []),
            externalImage: value.photos
                ? external
                    ? { ...external, provider: "unsplash" as const }
                    : null
                : (value.externalImage ?? null)
        };
    });

const dateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    });

const daySchema = z
    .object({
        dayId: id.optional(),
        dayNumber: z.number().int().positive().max(31),
        color: z
            .string()
            .regex(/^#[0-9a-f]{6}$/)
            .nullable()
            .optional(),
        date: dateSchema.nullable(),
        activities: z.array(activitySchema)
    })
    .strict();

const destinationSchema = locationSchema
    .extend({
        kind: z.enum(["city", "region", "country"]),
        country: z.string().refine(isCountryCode, "Choose a destination with a valid country"),
        externalPlaceId: z.string().startsWith("geoapify:").max(500)
    })
    .strict();

const boardFields = {
    fillerImagesEnabled: z.boolean().optional(),
    destination: destinationSchema.nullable().optional(),
    status: z.enum(["draft", "published"]),
    isCompleted: z.boolean().optional(),
    title: z.string().max(500),
    description: optionalText,
    visibility: z.enum(["collaborators", "friends", "public"]),
    tagIds: z.array(id).max(3),
    imageIds: z.array(id),
    coverImageId: id.nullable().optional(),
    days: z.array(daySchema).max(31)
};

export const createBoardSchema = z
    .object({
        ...boardFields,
        fillerImagesEnabled: z.boolean().default(false),
        visibility: boardFields.visibility.default("collaborators"),
        tagIds: boardFields.tagIds.default([]),
        imageIds: boardFields.imageIds.default([]),
        days: boardFields.days.default([])
    })
    .strict();

export const replaceBoardSchema = z
    .object({
        ...boardFields,
        revision: z.number().int().positive()
    })
    .strict();

export const boardIdParamsSchema = z
    .object({
        boardId: z.coerce.number().int().positive()
    })
    .strict();

export const imageIdParamsSchema = z
    .object({
        imageId: z.coerce.number().int().positive()
    })
    .strict();

export const boardListQuerySchema = z
    .object({
        scope: z.enum(["drafts", "published"]),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20)
    })
    .strict();

export const imageVariantQuerySchema = z
    .object({
        v: z.preprocess((val) => (Array.isArray(val) ? val[0] : val), z.coerce.number().int().nonnegative()).optional(),
        variant: z
            .preprocess(
                (val) => (Array.isArray(val) ? val[0] : val),
                z.enum(["display", "thumbnail", "large", "original"])
            )
            .default("display"),
        // Author photos carry Board context so the image service can enforce the same read permissions.
        boardId: z
            .preprocess((val) => (Array.isArray(val) ? val[0] : val), z.coerce.number().int().positive())
            .optional(),
        profileHandle: z
            .preprocess(
                (val) => (Array.isArray(val) ? val[0] : val),
                z
                    .string()
                    .regex(/^(?:[a-z0-9]|[a-z0-9][a-z0-9._]*[a-z0-9])$/)
                    .max(64)
            )
            .optional()
    })
    .strict()
    .refine((query) => !(query.boardId && query.profileHandle));

export const uploadIntentSchema = z
    .object({
        fileName: z.string().min(1).max(500),
        contentType: z.string().min(1).max(100),
        sizeBytes: z.number().int().positive()
    })
    .strict();

export const completeUploadSchema = z
    .object({
        uploadId: z.uuid()
    })
    .strict();

export type BoardWrite = Omit<z.infer<typeof createBoardSchema>, "fillerImagesEnabled"> & {
    fillerImagesEnabled?: boolean;
};
export type BoardReplace = z.infer<typeof replaceBoardSchema>;
export type BoardDayWrite = BoardWrite["days"][number];
export type BoardActivityWrite = BoardDayWrite["activities"][number];
export type BoardLocationWrite = NonNullable<BoardActivityWrite["location"]>;
export type UploadIntentWrite = z.infer<typeof uploadIntentSchema>;
